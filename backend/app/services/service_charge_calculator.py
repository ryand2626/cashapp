import logging
from typing import Optional
from decimal import Decimal, ROUND_HALF_UP

from app.services.payment_fee_calculator import PaymentFeeCalculator
from app.services.platform_service import PlatformSettingsService # May not be needed directly if rate is passed
from app.schemas.fee_schemas import PaymentMethodEnum, ServiceChargeBreakdown

logger = logging.getLogger(__name__)

class ServiceChargeCalculator:
    """
    Calculates the service charge, potentially including transaction fees.
    """

    def __init__(
        self,
        payment_fee_calculator: PaymentFeeCalculator,
        # platform_settings_service is kept if we need to fetch default service charge rates
        # or other related configurations directly within this service in the future.
        platform_settings_service: PlatformSettingsService
    ):
        self.payment_fee_calculator = payment_fee_calculator
        self.platform_settings_service = platform_settings_service


    def _round_currency(self, amount: Decimal) -> float:
        """Rounds a Decimal amount to 2 decimal places for currency representation."""
        quantizer = Decimal("0.01")
        return float(amount.quantize(quantizer, rounding=ROUND_HALF_UP))

    async def calculate_service_charge_with_fees(
        self,
        order_subtotal: float,
        service_charge_config_rate: float, # e.g., 0.10 for 10%. Fetched from PlatformSettingsService by caller.
        payment_method: PaymentMethodEnum,
        customer_pays_processor_fees: bool,
        # This flag below determines if the service charge should absorb the processor fee
        include_processor_fee_in_service_charge: bool,
        restaurant_id: Optional[str] = None,
        monthly_volume_for_restaurant: Optional[float] = None,
    ) -> ServiceChargeBreakdown:
        """
        Calculates the service charge, potentially including the payment processor fee.

        Args:
            order_subtotal: The subtotal of the order (basis for service charge).
            service_charge_config_rate: The configured rate for service charge (e.g., 0.1 for 10%).
            payment_method: The payment method used.
            customer_pays_processor_fees: True if the customer is intended to pay processor fees.
            include_processor_fee_in_service_charge: True if the service charge amount should
                                                     also cover the processor fee (when customer pays fees).
            restaurant_id: Optional restaurant ID.
            monthly_volume_for_restaurant: Optional monthly transaction volume.

        Returns:
            A ServiceChargeBreakdown dictionary.
        """
        dec_order_subtotal = Decimal(str(order_subtotal))
        dec_service_charge_config_rate = Decimal(str(service_charge_config_rate))

        if dec_order_subtotal < Decimal("0"):
            logger.warning("Order subtotal is negative. Service charge calculation will result in zero.")
            return ServiceChargeBreakdown(
                original_service_charge_on_subtotal=0.0,
                processor_fee_added_to_service_charge=0.0,
                final_service_charge_amount=0.0,
                service_charge_rate_applied=float(dec_service_charge_config_rate),
                include_transaction_fees_in_service_charge=include_processor_fee_in_service_charge
            )

        base_service_charge_on_subtotal = dec_order_subtotal * dec_service_charge_config_rate

        dec_processor_fee_component = Decimal("0.00")

        # The processor fee is calculated on the amount being paid, which includes subtotal + VAT + service charge.
        # For an accurate processor fee calculation that might be part of the service charge,
        # we face a potential circular dependency if the service charge itself changes the total amount processed.
        # Simplified approach: Calculate processor fee on (Subtotal + VAT + BaseServiceCharge)
        # A more precise calculation might require an iterative approach or solving an equation,
        # but typically this level of precision is not required and processor fees are based on the sum before this specific adjustment.
        # Let's assume the processor fee is calculated by the caller (PlatformFeeService) on a pre-determined amount.
        # OR, if this service is the sole calculator, it needs to determine the transaction amount for fee calculation.
        # For now, let's assume the processor fee is calculated on (subtotal + base_service_charge_on_subtotal + VAT).
        # The VAT amount is not directly available here, which indicates that the amount on which processor fee is calculated
        # should be passed in, or this service needs more inputs.
        #
        # Re-evaluating: The `PaymentFeeCalculator` calculates fee on `transaction_amount`.
        # If service charge includes processor fee, then `transaction_amount` for processor must include this dynamic SC.
        # This is complex. A common simplification:
        # 1. Calculate base SC.
        # 2. Calculate processor fee on (Subtotal + VAT + Base SC).
        # 3. If (customer_pays_fees AND include_fees_in_sc), add this processor fee to SC.
        # This means the processor fee is slightly underestimated as it's not on the final incremented SC.
        #
        # Let's use the provided `order_subtotal` as the primary basis for calculating the service charge,
        # and if processor fees are included, they are calculated on `order_subtotal + base_service_charge`.
        # This implies VAT is handled separately by the caller when determining the final transaction amount for processor.

        if include_processor_fee_in_service_charge and customer_pays_processor_fees and payment_method != PaymentMethodEnum.CASH:
            # Amount that would be processed if only subtotal + base SC were considered (excluding VAT for simplicity here,
            # assuming payment_fee_calculator gets the full amount including VAT from its caller)
            # A better approach: the caller (PlatformFeeService) should calculate processor_fee once on the correct total
            # and pass it to this function if it's to be included.
            #
            # For now, let's assume this service is responsible:
            # This is a simplification: actual processor fee is on (subtotal + VAT + final SC).
            # To avoid circularity, we calculate processor fee on (subtotal + base SC).
            # This means VAT needs to be considered by `payment_fee_calculator` if its input amount doesn't include it.
            # The `transaction_amount` for `calculate_processor_fee` should be the amount the processor sees.

            # To avoid circular dependencies, we'll calculate the processor fee
            # on the sum of subtotal and the initial service charge.
            # The caller (likely PlatformFeeService) will ensure PaymentFeeCalculator gets the *full* amount
            # (subtotal + VAT + this_calculated_service_charge) later if needed for final processor fee.
            # This specific calculation is to determine *how much of the processor fee gets absorbed by SC*.

            # Let's get the processor fee on the subtotal + base service charge.
            # This is an estimation of the fee portion that the service charge might cover.
            # The actual processor fee will be calculated by PlatformFeeService on the grand total.
            # This service only determines how the SC itself is composed.

            # This is the fee that would apply to the (subtotal + base_service_charge) part.
            # It's an *estimation* of the fee to be included in the SC.
            # The final, definitive processor fee calculation will be in PlatformFeeService.
            amount_for_fee_estimation = float(dec_order_subtotal + base_service_charge_on_subtotal)

            estimated_processor_fee_for_sc = await self.payment_fee_calculator.calculate_processor_fee(
                transaction_amount=amount_for_fee_estimation,
                payment_method=payment_method,
                restaurant_id=restaurant_id,
                monthly_volume_for_restaurant=monthly_volume_for_restaurant
            )
            dec_processor_fee_component = Decimal(str(estimated_processor_fee_for_sc))

        final_service_charge_amount = base_service_charge_on_subtotal + dec_processor_fee_component

        return ServiceChargeBreakdown(
            original_service_charge_on_subtotal=self._round_currency(base_service_charge_on_subtotal),
            processor_fee_added_to_service_charge=self._round_currency(dec_processor_fee_component),
            final_service_charge_amount=self._round_currency(final_service_charge_amount),
            service_charge_rate_applied=float(dec_service_charge_config_rate),
            include_transaction_fees_in_service_charge=include_processor_fee_in_service_charge
        )

# Example Usage (conceptual)
# async def main_sc_example():
#     from app.core.database import SessionLocal
#     db = SessionLocal()
#     try:
#         pss = PlatformSettingsService(db)
#         pfc = PaymentFeeCalculator(pss)
#         scc = ServiceChargeCalculator(pfc, pss)

#         # Example: Subtotal £100, Service Charge Rate 10%
#         # Payment with Stripe, customer pays fees, SC includes processor fee.
#         # Assume Stripe fee is 1.4% + £0.20. On £110 (100 + 10% SC), fee is approx £1.54 + £0.20 = £1.74

#         breakdown = await scc.calculate_service_charge_with_fees(
#             order_subtotal=100.0,
#             service_charge_config_rate=0.10,
#             payment_method=PaymentMethodEnum.STRIPE,
#             customer_pays_processor_fees=True,
#             include_processor_fee_in_service_charge=True,
#             restaurant_id="some-restaurant-id"
#         )
#         print("Service Charge Breakdown (Stripe, Customer Pays, SC includes Proc Fee):")
#         for key, value in breakdown.items():
#             print(f"  {key}: {value}")
#         # Expected: base_sc = 10.0. proc_fee_on_110 (approx) = (0.014 * 110) + 0.20 = 1.54 + 0.20 = 1.74
#         # final_sc = 10.0 + 1.74 = 11.74
#         # proc_fee_added = 1.74

#         breakdown_no_include = await scc.calculate_service_charge_with_fees(
#             order_subtotal=100.0,
#             service_charge_config_rate=0.10,
#             payment_method=PaymentMethodEnum.STRIPE,
#             customer_pays_processor_fees=True,
#             include_processor_fee_in_service_charge=False, # SC does NOT include processor fee
#             restaurant_id="some-restaurant-id"
#         )
#         print("\nService Charge Breakdown (Stripe, Customer Pays, SC NOT includes Proc Fee):")
#         for key, value in breakdown_no_include.items():
#             print(f"  {key}: {value}")
#         # Expected: base_sc = 10.0. proc_fee_added = 0.0. final_sc = 10.0.

#     finally:
#         db.close()

# if __name__ == "__main__":
#     import asyncio
#     # asyncio.run(main_sc_example())
