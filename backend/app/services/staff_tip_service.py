import logging
from typing import List, Optional
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.orm import Session

from app.schemas.fee_schemas import StaffMember, StaffTipDistribution # Input/Output schema
from app.models.financial_records import StaffTipDistributionRecord # DB model
from app.core.database import SessionLocal # For example usage, service should get session via DI

logger = logging.getLogger(__name__)

class StaffTipService:
    """
    Manages the distribution of tips to staff members,
    accounting for service charges and transaction fees.
    """

    def __init__(self, db: Session):
        self.db = db

    def _round_currency(self, amount: Decimal) -> float:
        """Rounds a Decimal amount to 2 decimal places for currency representation."""
        quantizer = Decimal("0.01")
        return float(amount.quantize(quantizer, rounding=ROUND_HALF_UP))

    def distribute_order_tips(
        self,
        order_reference: str,
        total_tips_collected: float,
        # Total service charge applied to the order. This might have absorbed some processor fees.
        service_charge_amount_on_order: float,
        # The portion of the service_charge_amount_on_order that was specifically to cover a processor fee.
        processor_fee_covered_by_service_charge: float,
        assigned_staff: List[StaffMember],
        tip_distribution_strategy: str = "equal_split" # e.g., "equal_split", "points_based"
    ) -> List[StaffTipDistribution]:
        """
        Distributes tips collected from an order to the assigned staff members.

        Args:
            order_reference: Reference for the order.
            total_tips_collected: The gross amount of tips collected for this order.
            service_charge_amount_on_order: The total amount of service charge applied to the order.
                                            If tips are given on top of SC, this might not reduce tips.
                                            If SC is "in lieu of tips", this is critical.
            processor_fee_covered_by_service_charge: The portion of the service charge that was
                                                     used to cover payment processor fees. This amount
                                                     effectively reduces the "service" portion of SC.
            assigned_staff: A list of staff members assigned to this order.
            tip_distribution_strategy: The strategy to use for distributing tips.

        Returns:
            A list of StaffTipDistribution dictionaries detailing each staff member's allocated tip.
        """
        dec_total_tips_collected = Decimal(str(total_tips_collected))
        dec_service_charge_amount_on_order = Decimal(str(service_charge_amount_on_order))
        dec_processor_fee_covered_by_service_charge = Decimal(str(processor_fee_covered_by_service_charge))

        if not assigned_staff:
            logger.warning(f"No staff assigned for order {order_reference}. Tips collected: {total_tips_collected} will not be distributed by this call.")
            # Depending on policy, these undistributed tips might go to a general pool or be handled differently.
            return []

        if dec_total_tips_collected <= Decimal("0"):
            logger.info(f"No tips collected for order {order_reference}. Nothing to distribute.")
            return []

        # Business Logic: How does Service Charge affect tips?
        # Assumption 1: Tips are entirely separate from Service Charge. SC doesn't reduce tip pool.
        # Assumption 2: Service Charge is "in lieu of tips" or partially replaces tips.
        # The issue: "Service Charge includes transaction fees, reducing actual staff tips"
        # This implies that the *service charge itself* (if it was meant for staff) is reduced by the fees it absorbed.
        # And "Transaction fee impact display" / "Transaction fee impact on tips"
        # This suggests the tips themselves might be reduced if they are used to cover fees,
        # OR that the overall pool for staff (tips + service_charge_for_staff) is reduced.

        # Let's assume `total_tips_collected` is purely what the customer designated as a "tip".
        # The `processor_fee_covered_by_service_charge` reduces the *service charge* amount that might go to staff,
        # not directly the `total_tips_collected` unless tips are used to pay SC.

        # For now, let's assume `total_tips_collected` is the net distributable tip pool from actual tips.
        # The "reduction of staff tips due to service charge" might mean that if SC is high, customers tip less,
        # or that if SC is meant for staff, that SC amount is reduced by the fees it absorbed.
        # The `transaction_fee_impact` field in `staff_tip_distributions` table suggests a direct impact.

        # Scenario A: `total_tips_collected` is the only pool. `processor_fee_covered_by_service_charge`
        #             is for informational purposes on how SC was structured but doesn't touch this tip pool.
        # Scenario B: The "actual staff tips" mentioned in "Gap 3" means the distributable amount from tips
        #             is reduced if the service charge (which might also go to staff) had to cover fees.
        #             This is complex.

        # Let's go with a clearer model:
        # `distributable_tips = total_tips_collected`
        # `service_charge_net_for_staff = service_charge_amount_on_order - processor_fee_covered_by_service_charge`
        # The service will distribute `distributable_tips`.
        # The `transaction_fee_impact` on the `StaffTipDistributionRecord` will be calculated per staff based on their share of `processor_fee_covered_by_service_charge` IF the SC was supposed to go to them.

        # For this function, let's focus on distributing `total_tips_collected`.
        # The impact of `processor_fee_covered_by_service_charge` will be recorded per staff member,
        # assuming it reduces a separate pool (like service charge intended for staff).

        distributable_tip_pool = dec_total_tips_collected

        staff_tip_distributions: List[StaffTipDistribution] = []
        num_staff = len(assigned_staff)

        if tip_distribution_strategy == "equal_split":
            if num_staff > 0:
                tip_per_staff = distributable_tip_pool / Decimal(num_staff)
                # The `transaction_fee_impact` on tips. If service charge was meant for staff,
                # and it absorbed processor fees, then that's an impact.
                # This impact is on the service charge portion that would have gone to staff.
                # If we assume `processor_fee_covered_by_service_charge` is the total impact,
                # then per staff it's:
                impact_per_staff = dec_processor_fee_covered_by_service_charge / Decimal(num_staff) if num_staff > 0 else Decimal("0.00")


                for staff_member_data in assigned_staff:
                    staff_member = StaffMember(id=staff_member_data['id'], name=staff_member_data['name'])

                    # This is the distribution of the explicit "tips"
                    allocated_tip = tip_per_staff

                    distribution_entry = StaffTipDistribution(
                        staff_member=staff_member,
                        tip_amount_allocated=self._round_currency(allocated_tip),
                        # `notes` could indicate the transaction_fee_impact if SC was also part of their income
                        notes=f"Service charge related processor fee impact per staff: {self._round_currency(impact_per_staff)}"
                    )
                    staff_tip_distributions.append(distribution_entry)

                    # Persist to DB
                    record = StaffTipDistributionRecord(
                        order_reference=order_reference,
                        staff_id=staff_member.id,
                        tip_amount_gross=self._round_currency(allocated_tip), # Gross tip share
                        service_charge_deduction=0.0, # Assuming SC doesn't directly reduce this tip amount here
                                                      # This field might be used if SC is pooled with tips then distributed
                        transaction_fee_impact_on_tip=self._round_currency(impact_per_staff), # Share of SC's fee burden
                        tip_amount_net=self._round_currency(allocated_tip), # Net from tips. If SC also for staff, their total income is this + SC_share
                        # distribution_timestamp is server_default
                    )
                    self.db.add(record)
            else:
                logger.warning(f"Tip distribution strategy is '{tip_distribution_strategy}' but no staff found for order {order_reference}.")

        # elif tip_distribution_strategy == "points_based":
            # Placeholder for future strategy:
            # total_points = sum(staff.get('points', 1) for staff in assigned_staff)
            # for staff in assigned_staff:
            #     points = staff.get('points', 1)
            #     share = (Decimal(points) / Decimal(total_points)) * distributable_tip_pool
            #     ... create StaffTipDistribution ...
            # pass
        else:
            logger.error(f"Unsupported tip distribution strategy: {tip_distribution_strategy}")
            raise ValueError(f"Unsupported tip distribution strategy: {tip_distribution_strategy}")

        try:
            self.db.commit()
            for dist_entry_schema, db_record in zip(staff_tip_distributions, self.db.query(StaffTipDistributionRecord).filter(StaffTipDistributionRecord.order_reference == order_reference).all()): # Re-fetch to get IDs if needed, or use refreshed objects
                 # If you need the DB record ID in the returned schema, you'd map it here.
                 # For now, the schema doesn't include the DB record ID.
                 pass
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error saving staff tip distributions for order {order_reference}: {e}", exc_info=True)
            raise

        return staff_tip_distributions

    def get_tip_distributions_for_order(self, order_reference: str) -> List[StaffTipDistributionRecord]:
        """Retrieves all tip distribution records for a given order."""
        return self.db.query(StaffTipDistributionRecord).filter(
            StaffTipDistributionRecord.order_reference == order_reference
        ).all()

    def get_tip_distributions_for_staff(self, staff_id: str, start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[StaffTipDistributionRecord]:
        """Retrieves all tip distribution records for a given staff member, optionally within a date range."""
        query = self.db.query(StaffTipDistributionRecord).filter(StaffTipDistributionRecord.staff_id == staff_id)
        if start_date:
            query = query.filter(StaffTipDistributionRecord.distribution_timestamp >= start_date)
        if end_date:
            query = query.filter(StaffTipDistributionRecord.distribution_timestamp <= end_date)
        return query.order_by(StaffTipDistributionRecord.distribution_timestamp.desc()).all()


# Example Usage (conceptual)
# async def main_st_example():
#     db_session = SessionLocal() # Example: get a session
#     try:
#         staff_tip_service = StaffTipService(db=db_session)
#
#         staff_list = [
#             StaffMember(id="staff_1", name="Alice"),
#             StaffMember(id="staff_2", name="Bob")
#         ]
#
#         order_ref = f"ORDER_{uuid.uuid4().hex[:6]}"
#
#         distributions = staff_tip_service.distribute_order_tips(
#             order_reference=order_ref,
#             total_tips_collected=20.0,
#             service_charge_amount_on_order=10.0, # e.g. 10% SC on a L100 order
#             processor_fee_covered_by_service_charge=1.50, # SC had to cover this much fee
#             assigned_staff=staff_list
#         )
#
#         print(f"Tip distributions for order {order_ref}:")
#         for dist in distributions:
#             print(f"  Staff: {dist['staff_member']['name']}, Tip: {dist['tip_amount_allocated']}, Notes: {dist['notes']}")
#
#         retrieved_dists = staff_tip_service.get_tip_distributions_for_order(order_ref)
#         print(f"\nRetrieved records from DB for order {order_ref}:")
#         for r_dist in retrieved_dists:
#             print(f"  Staff ID: {r_dist.staff_id}, Net Tip: {r_dist.tip_amount_net}, Gross Tip: {r_dist.tip_amount_gross}, Fee Impact: {r_dist.transaction_fee_impact_on_tip}")
#
#     finally:
#         db_session.close()

# if __name__ == "__main__":
#     import asyncio
#     # This example requires async context if service methods become async
#     # For now, distribute_order_tips is synchronous but interacts with DB.
#     # asyncio.run(main_st_example()) # if main_st_example was async
#
#     # Synchronous execution for the current design:
#     # Create a dummy Session for the example if not running in FastAPI context
#     from sqlalchemy import create_engine
#     from sqlalchemy.orm import sessionmaker
#     from app.core.database import Base # Your Base for models
#     if __name__ == "__main__":
#         # In-memory SQLite database for example purposes
#         engine = create_engine("sqlite:///:memory:")
#         Base.metadata.create_all(engine) # Create tables
#         TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
#
#         db_session = TestingSessionLocal()
#         try:
#             staff_tip_service = StaffTipService(db=db_session)
#             staff_list = [
#                 StaffMember(id="staff_1", name="Alice"),
#                 StaffMember(id="staff_2", name="Bob")
#             ]
#             order_ref = f"ORDER_EXAMPLE_1"
#             distributions = staff_tip_service.distribute_order_tips(
#                 order_reference=order_ref,
#                 total_tips_collected=20.0,
#                 service_charge_amount_on_order=10.0,
#                 processor_fee_covered_by_service_charge=1.50,
#                 assigned_staff=staff_list
#             )
#             print(f"Tip distributions for order {order_ref}:")
#             for dist in distributions:
#                 print(f"  Staff: {dist['staff_member']['name']}, Tip: {dist['tip_amount_allocated']}, Notes: {dist['notes']}")
#
#             retrieved_dists = staff_tip_service.get_tip_distributions_for_order(order_ref)
#             print(f"\nRetrieved records from DB for order {order_ref}: {len(retrieved_dists)} records")
#             for r_dist in retrieved_dists:
#                 print(f"  DB Record ID: {r_dist.id}, Staff ID: {r_dist.staff_id}, Net Tip: {r_dist.tip_amount_net}, Gross Tip: {r_dist.tip_amount_gross}, Fee Impact: {r_dist.transaction_fee_impact_on_tip}")
#         finally:
#             db_session.close()
