import logging
from typing import Optional, Dict, Any
from decimal import Decimal, ROUND_HALF_UP

from app.services.platform_service import PlatformSettingsService
from app.services.payment_fee_calculator import PaymentFeeCalculator
from app.schemas.fee_schemas import PaymentMethodEnum, CustomerTotalBreakdown

logger = logging.getLogger(__name__)

class PlatformFeeService:
    """
    Calculates the platform's transaction fee and the final customer total.
    """

    # PLATFORM_FEE_RATE should ideally be fetched from PlatformSettingsService
    # For example, as a config key like 'platform.transaction_fee.rate'
    PLATFORM_FEE_RATE = Decimal("0.01")  # 1%

    def __init__(
        self,
        payment_fee_calculator: PaymentFeeCalculator,
        platform_settings_service: PlatformSettingsService, # Potentially to fetch PLATFORM_FEE_RATE
    ):
        self.payment_fee_calculator = payment_fee_calculator
        self.platform_settings_service = platform_settings_service
        # In the future, self.PLATFORM_FEE_RATE could be initialized by fetching from platform_settings_service

    def _round_currency(self, amount: Decimal) -> float:
        """Rounds a Decimal amount to 2 decimal places for currency representation."""
        quantizer = Decimal("0.01")
        return float(amount.quantize(quantizer, rounding=ROUND_HALF_UP))

    def calculate_platform_fee(self, amount_subject_to_platform_fee: Decimal) -> Decimal:
        """
        Calculates the 1% platform fee on the given amount.

        Args:
            amount_subject_to_platform_fee: The amount on which the platform fee is calculated.
                                            This is typically (subtotal + VAT + service_charge + processor_fee_if_customer_pays).
        Returns:
            The calculated platform fee as a Decimal.
        """
        if amount_subject_to_platform_fee < Decimal("0"):
            # Or handle as an error, fees typically not on negative amounts unless it's a refund scenario with specific rules
            logger.warning("amount_subject_to_platform_fee is negative, platform fee will be 0.")
            return Decimal("0.00")

        # fee_rate = await self.platform_settings_service.get_platform_setting("platform.transaction_fee.rate") # Example
        # current_platform_fee_rate = Decimal(str(fee_rate['value']['value'])) if fee_rate else self.PLATFORM_FEE_RATE
        current_platform_fee_rate = self.PLATFORM_FEE_RATE

        platform_fee = amount_subject_to_platform_fee * current_platform_fee_rate
        return platform_fee

    async def calculate_customer_total(
        self,
        subtotal: float,
        vat_amount: float, # Explicit VAT amount
        service_charge_final_amount: float, # Final service charge (could already include processor fee)
        payment_method: PaymentMethodEnum,
        customer_pays_processor_fees: bool,
        restaurant_id: Optional[str] = None,
        monthly_volume_for_restaurant: Optional[float] = None,
    ) -> CustomerTotalBreakdown:
        """
        Calculates the detailed breakdown of the customer's total payment.

        Args:
            subtotal: The order subtotal (before VAT, service charge, and other fees).
            vat_amount: The total VAT amount for the order.
            service_charge_final_amount: The final service charge amount. This amount might already
                                         include processor fees if that's the configuration.
            payment_method: The payment method chosen by the customer.
            customer_pays_processor_fees: Boolean indicating if the customer bears the processor fee.
            restaurant_id: Optional ID of the restaurant.
            monthly_volume_for_restaurant: Optional monthly transaction volume for the restaurant.

        Returns:
            A CustomerTotalBreakdown dictionary.
        """
        dec_subtotal = Decimal(str(subtotal))
        dec_vat_amount = Decimal(str(vat_amount))
        dec_service_charge_final_amount = Decimal(str(service_charge_final_amount))

        calculated_processor_fee = Decimal("0.00")

        # Calculate processor fee based on an intermediate total that would be subject to it.
        # This intermediate total is (subtotal + VAT). Service charge is often not subject to processor fee itself,
        # but the payment for the service charge part *is* part of the transaction amount.
        # The processor fee is calculated on the total amount processed by the payment gateway.

        # Tentative amount that the processor will handle, before processor fee itself and platform fee.
        # This is Subtotal + VAT + Service Charge.
        amount_before_processor_and_platform_fees = dec_subtotal + dec_vat_amount + dec_service_charge_final_amount

        if payment_method != PaymentMethodEnum.CASH: # No processor fees for cash
            raw_processor_fee = await self.payment_fee_calculator.calculate_processor_fee(
                transaction_amount=float(amount_before_processor_and_platform_fees), # pass as float
                payment_method=payment_method,
                restaurant_id=restaurant_id,
                monthly_volume_for_restaurant=monthly_volume_for_restaurant,
            )
            calculated_processor_fee = Decimal(str(raw_processor_fee))

        actual_processor_fee_paid_by_customer = Decimal("0.00")
        if customer_pays_processor_fees and payment_method != PaymentMethodEnum.CASH:
            actual_processor_fee_paid_by_customer = calculated_processor_fee

        # Amount on which platform fee is calculated:
        # Subtotal + VAT + Service Charge + Processor Fee (if customer pays it directly)
        amount_subject_to_platform_fee = dec_subtotal + dec_vat_amount + dec_service_charge_final_amount + actual_processor_fee_paid_by_customer

        calculated_platform_fee = self.calculate_platform_fee(amount_subject_to_platform_fee)

        # Final total for the customer
        dec_final_total = amount_subject_to_platform_fee + calculated_platform_fee

        return CustomerTotalBreakdown(
            subtotal=self._round_currency(dec_subtotal),
            vat_amount=self._round_currency(dec_vat_amount),
            service_charge_calculated=self._round_currency(dec_service_charge_final_amount),
            platform_fee=self._round_currency(calculated_platform_fee),
            processor_fee=self._round_currency(calculated_processor_fee), # This is the actual processor fee value
            customer_pays_processor_fees=customer_pays_processor_fees,
            final_total=self._round_currency(dec_final_total),
            notes=None
        )

# Example Usage (conceptual)
# async def main_pf_example():
#     from app.core.database import SessionLocal
#     db = SessionLocal()
#     try:
#         pss = PlatformSettingsService(db)
#         pfc = PaymentFeeCalculator(pss)
#         platform_fee_service = PlatformFeeService(pfc, pss)
#
#         # Example: Order subtotal £100, VAT £20, Service Charge (final) £10
#         # Customer pays with Stripe, and customer pays processor fees.
#         breakdown = await platform_fee_service.calculate_customer_total(
#             subtotal=100.0,
#             vat_amount=20.0,
#             service_charge_final_amount=10.0, # Assume this is already calculated
#             payment_method=PaymentMethodEnum.STRIPE,
#             customer_pays_processor_fees=True,
#             restaurant_id="some-restaurant-id"
#         )
#         print("Customer Total Breakdown (Stripe, Customer Pays Fees):")
#         for key, value in breakdown.items():
#             print(f"  {key}: {value}")
#
#         # Example: Customer pays with Cash
#         breakdown_cash = await platform_fee_service.calculate_customer_total(
#             subtotal=100.0,
#             vat_amount=20.0,
#             service_charge_final_amount=10.0,
#             payment_method=PaymentMethodEnum.CASH,
#             customer_pays_processor_fees=False, # Doesn't matter for cash
#             restaurant_id="some-restaurant-id"
#         )
#         print("\nCustomer Total Breakdown (Cash):")
#         for key, value in breakdown_cash.items():
#             print(f"  {key}: {value}")
#
#     finally:
#         db.close()

# if __name__ == "__main__":
#     import asyncio
#     # asyncio.run(main_pf_example())
