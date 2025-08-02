"""
Database Transaction Management for Fynlo POS
Provides decorators and utilities for atomic operations and rollback handling.
"""

import functools
import logging
from contextlib import asynccontextmanager
from typing import Any, Callable, Optional, Type, Union
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError, IntegrityError, DisconnectionError
import asyncio
from datetime import datetime

logger = logging.getLogger(__name__)

class TransactionError(Exception):
    """Custom exception for transaction failures"""
    pass

class RetryableTransactionError(TransactionError):
    """Exception for transactions that can be retried"""
    pass

class NonRetryableTransactionError(TransactionError):
    """Exception for transactions that should not be retried"""
    pass


class TransactionManager:
    """
    Manages database transactions with retry logic, rollback handling,
    and atomic operation support.
    """
    
    def __init__(self, max_retries: int = 3, retry_delay: float = 0.1):
        self.max_retries = max_retries
        self.retry_delay = retry_delay
    
    @asynccontextmanager
    async def atomic_transaction(self, db: Session):
        """
        Context manager for atomic database transactions with automatic rollback.
        
        Usage:
            async with transaction_manager.atomic_transaction(db) as tx:
                # Perform database operations
                db.add(object1)
                db.add(object2)
                # Transaction automatically committed on successful exit
                # Automatically rolled back on exception
        """
        transaction_started = datetime.utcnow()
        
        try:
            # Begin transaction if not already in one
            if db.in_transaction():
                logger.debug("Already in transaction, using existing transaction")
                yield db
            else:
                logger.debug("Starting new atomic transaction")
                # SQLAlchemy automatically begins transaction on first operation
                yield db
                
                # Commit if we reach this point without exceptions
                db.commit()
                
                duration = (datetime.utcnow() - transaction_started).total_seconds()
                logger.info(f"✅ Transaction committed successfully (duration: {duration:.3f}s)")
                
        except IntegrityError as e:
            # Database constraint violations
            db.rollback()
            duration = (datetime.utcnow() - transaction_started).total_seconds()
            logger.error(f"❌ Transaction rolled back - Integrity constraint violation (duration: {duration:.3f}s): {e}")
            raise NonRetryableTransactionError(f"Database constraint violation: {e}")
            
        except DisconnectionError as e:
            # Database connection issues - these can be retried
            db.rollback()
            duration = (datetime.utcnow() - transaction_started).total_seconds()
            logger.error(f"❌ Transaction rolled back - Database disconnection (duration: {duration:.3f}s): {e}")
            raise RetryableTransactionError(f"Database connection error: {e}")
            
        except SQLAlchemyError as e:
            # Other SQLAlchemy errors
            db.rollback()
            duration = (datetime.utcnow() - transaction_started).total_seconds()
            logger.error(f"❌ Transaction rolled back - SQLAlchemy error (duration: {duration:.3f}s): {e}")
            # Most SQLAlchemy errors are non-retryable
            raise NonRetryableTransactionError(f"Database error: {e}")
            
        except Exception as e:
            # Any other unexpected error
            db.rollback()
            duration = (datetime.utcnow() - transaction_started).total_seconds()
            logger.error(f"❌ Transaction rolled back - Unexpected error (duration: {duration:.3f}s): {e}")
            raise NonRetryableTransactionError(f"Unexpected error during transaction: {e}")
    
    async def execute_with_retry(self, operation: Callable, *args, **kwargs) -> Any:
        """
        Execute a database operation with retry logic for transient failures.
        
        Args:
            operation: The function to execute
            *args: Arguments to pass to the operation
            **kwargs: Keyword arguments to pass to the operation
            
        Returns:
            Result of the operation
            
        Raises:
            NonRetryableTransactionError: For errors that shouldn't be retried
            TransactionError: If all retries are exhausted
        """
        last_exception = None
        
        for attempt in range(self.max_retries + 1):
            try:
                logger.debug(f"Executing operation (attempt {attempt + 1}/{self.max_retries + 1})")
                result = await operation(*args, **kwargs)
                
                if attempt > 0:
                    logger.info(f"✅ Operation succeeded on attempt {attempt + 1}")
                
                return result
                
            except NonRetryableTransactionError:
                # Don't retry these
                raise
                
            except RetryableTransactionError as e:
                last_exception = e
                if attempt < self.max_retries:
                    wait_time = self.retry_delay * (2 ** attempt)  # Exponential backoff
                    logger.warning(f"⚠️ Retryable error on attempt {attempt + 1}, waiting {wait_time:.3f}s before retry: {e}")
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    logger.error(f"❌ All retry attempts exhausted")
                    break
                    
            except Exception as e:
                # Treat unknown exceptions as non-retryable
                logger.error(f"❌ Non-retryable error: {e}")
                raise NonRetryableTransactionError(f"Unexpected error: {e}")
        
        # If we get here, all retries were exhausted
        raise TransactionError(f"Operation failed after {self.max_retries + 1} attempts. Last error: {last_exception}")


def transactional(max_retries: int = 3, retry_delay: float = 0.1):
    """
    Decorator to wrap a function in an atomic transaction with retry logic.
    
    The decorated function should take a 'db' parameter as its first argument.
    
    Args:
        max_retries: Maximum number of retry attempts for retryable errors
        retry_delay: Base delay between retries (with exponential backoff)
    
    Usage:
        @transactional(max_retries=5, retry_delay=0.2)
        async def create_order_atomically(db: Session, order_data: dict):
            # All database operations in this function will be atomic
            order = Order(**order_data)
            db.add(order)
            # Update inventory
            # Send notifications
            # etc.
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract db session from arguments
            db = None
            if args and hasattr(args[0], 'query'):  # First arg is Session
                db = args[0]
            elif 'db' in kwargs:
                db = kwargs['db']
            else:
                raise ValueError("No database session found in function arguments")
            
            transaction_manager = TransactionManager(max_retries=max_retries, retry_delay=retry_delay)
            
            async def operation():
                async with transaction_manager.atomic_transaction(db):
                    return await func(*args, **kwargs)
            
            return await transaction_manager.execute_with_retry(operation)
        
        return wrapper
    return decorator


def optimistic_lock_retry(version_field: str = 'version', max_retries: int = 5):
    """
    Decorator for handling optimistic locking with automatic retry.
    
    Args:
        version_field: Name of the version field used for optimistic locking
        max_retries: Maximum number of retry attempts for version conflicts
    
    Usage:
        @optimistic_lock_retry(version_field='version', max_retries=10)
        async def update_product_stock(db: Session, product_id: str, quantity_change: int):
            product = db.query(Product).filter(Product.id == product_id).first()
            original_version = product.version
            product.stock_quantity += quantity_change
            product.version += 1
            # If another process updated the product, this will fail and retry
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except IntegrityError as e:
                    if version_field in str(e) and attempt < max_retries:
                        logger.warning(f"⚠️ Optimistic lock conflict (attempt {attempt + 1}), retrying...")
                        await asyncio.sleep(0.05 * (attempt + 1))  # Short delay with backoff
                        continue
                    raise
            
            raise TransactionError(f"Optimistic lock failed after {max_retries + 1} attempts")
        
        return wrapper
    return decorator


class BatchTransactionManager:
    """
    Manages batch operations with transaction boundaries and partial failure handling.
    """
    
    def __init__(self, batch_size: int = 100, rollback_on_partial_failure: bool = True):
        self.batch_size = batch_size
        self.rollback_on_partial_failure = rollback_on_partial_failure
    
    async def execute_batch(self, db: Session, operations: list, operation_handler: Callable) -> dict:
        """
        Execute a batch of operations with proper transaction management.
        
        Args:
            db: Database session
            operations: List of operations to execute
            operation_handler: Function to handle each individual operation
            
        Returns:
            Dictionary with results: {'successful': int, 'failed': int, 'errors': list}
        """
        results = {
            'successful': 0,
            'failed': 0,
            'errors': [],
            'total': len(operations)
        }
        
        # Process in batches
        for i in range(0, len(operations), self.batch_size):
            batch = operations[i:i + self.batch_size]
            batch_results = await self._execute_batch_chunk(db, batch, operation_handler)
            
            # Aggregate results
            results['successful'] += batch_results['successful']
            results['failed'] += batch_results['failed']
            results['errors'].extend(batch_results['errors'])
        
        logger.info(f"✅ Batch execution completed: {results['successful']}/{results['total']} successful")
        
        return results
    
    async def _execute_batch_chunk(self, db: Session, batch: list, operation_handler: Callable) -> dict:
        """Execute a single batch chunk"""
        chunk_results = {
            'successful': 0,
            'failed': 0,
            'errors': []
        }
        
        transaction_manager = TransactionManager()
        
        try:
            async with transaction_manager.atomic_transaction(db):
                for operation in batch:
                    try:
                        await operation_handler(db, operation)
                        chunk_results['successful'] += 1
                    except Exception as e:
                        chunk_results['failed'] += 1
                        chunk_results['errors'].append({
                            'operation': str(operation),
                            'error': str(e)
                        })
                        
                        if self.rollback_on_partial_failure:
                            logger.error(f"❌ Batch operation failed, rolling back entire batch: {e}")
                            raise  # This will trigger rollback of entire batch
                        else:
                            logger.warning(f"⚠️ Individual operation failed, continuing with batch: {e}")
                            continue
                
        except Exception as e:
            # If we're here with rollback_on_partial_failure=True, the entire batch failed
            if self.rollback_on_partial_failure:
                chunk_results['successful'] = 0  # All operations rolled back
                chunk_results['failed'] = len(batch)
                chunk_results['errors'] = [{'batch_error': str(e)}]
        
        return chunk_results


# Global instances
transaction_manager = TransactionManager()
batch_transaction_manager = BatchTransactionManager()