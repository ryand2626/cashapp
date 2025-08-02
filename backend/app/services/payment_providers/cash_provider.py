from decimal import Decimal
from typing import Dict, Any, Optional, List
import uuid
from datetime import datetime
import logging

from .base_provider import BasePaymentProvider, RefundItemDetail # Import new base
# Assuming PaymentStatus is a shared enum, if not, define or import appropriately
# from ..payment_providers import PaymentStatus # Or your enum location

logger = logging.getLogger(__name__)

class PaymentStatus: # Placeholder if not imported
    SUCCESS = "success"
    FAILED = "failed"
    PENDING = "pending"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"

class CashProvider(BasePaymentProvider):
    """Provider for cash transactions and refunds."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        # Cash provider might not need specific API keys from config in the same way
        # as online gateways. Pass a minimal config or defaults.
        super().__init__(api_key="N/A", config=config or {})
        self.provider_name = "cash"
        logger.info("CashProvider initialized.")

    async def process_payment(
        self,
        amount: Decimal,
        currency: str = "GBP",
        order_id: Optional[str] = None,
        cash_received: Optional[Decimal] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Processes a cash payment.
        For cash, this typically means recording the transaction.
        """
        if amount <= 0:
            logger.error("Cash payment error: Amount must be positive.")
            return {"success": False, "error": "Amount must be positive.", "status": PaymentStatus.FAILED}

        transaction_id = f"CASH_TXN_{uuid.uuid4()}"
        timestamp = datetime.utcnow().isoformat() + "Z"

        change_due = Decimal(0)
        if cash_received is not None:
            if cash_received < amount:
                logger.error(f"Cash payment error for order {order_id}: Insufficient cash received. Amount: {amount}, Received: {cash_received}")
                return {
                    "success": False,
                    "error": "Insufficient cash received.",
                    "status": PaymentStatus.FAILED,
                    "transaction_id": transaction_id,
                    "amount": float(amount),
                    "currency": currency,
                    "timestamp": timestamp
                }
            change_due = cash_received - amount

        logger.info(f"Cash payment processed for order {order_id}: Amount: {amount} {currency}, Transaction ID: {transaction_id}")
        return {
            "success": True,
            "transaction_id": transaction_id,
            "gateway_transaction_id": transaction_id, # For cash, internal ID is the gateway ID
            "status": PaymentStatus.SUCCESS, # Cash payments are typically successful immediately
            "amount_processed": float(amount),
            "currency": currency,
            "payment_method_type": "cash",
            "created_at": timestamp,
            "change_due": float(change_due),
            "raw_response": {"message": "Cash payment recorded."}
        }

    async def refund_payment(
        self,
        transaction_id: str, # Original Fynlo transaction_id (or a cash specific one)
        amount_to_refund: Decimal,
        reason: Optional[str] = None,
        items_to_refund: Optional[List[RefundItemDetail]] = None,
        order_id: Optional[str] = None, # Fynlo's internal order ID
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Processes a cash refund. This is an internal ledger operation.
        """
        if amount_to_refund <= 0:
            logger.error(f"Cash refund error for order {order_id}: Refund amount must be positive. Received: {amount_to_refund}")
            return {"success": False, "error": "Refund amount must be positive.", "status": "failed"}

        refund_id = f"CASH_REFUND_{uuid.uuid4()}"
        timestamp = datetime.utcnow().isoformat() + "Z"

        logger.info(
            f"Cash refund processed for order {order_id} (original txn: {transaction_id}): "
            f"Amount: {amount_to_refund}, Refund ID: {refund_id}, Reason: {reason}"
        )

        # For cash refunds, there's no external gateway call.
        # The success indicates it's been logged internally.
        return {
            "success": True,
            "refund_id": refund_id,
            "gateway_transaction_id": transaction_id, # Reference to original transaction
            "status": PaymentStatus.REFUNDED, # Or a more specific "processed_internally"
            "amount_refunded": float(amount_to_refund),
            # "currency" would typically come from the original transaction context if needed
            "reason": reason,
            "created_at": timestamp,
            "raw_response": {"message": "Cash refund recorded internally."}
        }

    async def get_transaction_details(self, transaction_id: str) -> Dict[str, Any]:
        logger.warning("CashProvider: get_transaction_details is not typically applicable for cash.")
        return {"status": "not_applicable", "message": "Cash transactions are typically not queried via gateway."}

    async def void_payment(self, transaction_id: str, **kwargs) -> Dict[str, Any]:
        logger.warning("CashProvider: void_payment is not typically applicable for cash in the same way as card payments.")
        # A "void" for cash might mean cancelling an order before cash is exchanged or immediately after.
        # This could be logged as a specific type of refund or cancellation.
        return {
            "success": True, # Or False if voiding is not a concept here
            "status": "void_not_applicable_or_manual", # Or PaymentStatus.CANCELLED if that's how it's handled
            "message": "Cash transaction voiding is a manual process or handled as cancellation/refund."
        }

    def calculate_fee(self, amount: Decimal) -> Decimal:
        return Decimal(0) # No processing fees for cash
