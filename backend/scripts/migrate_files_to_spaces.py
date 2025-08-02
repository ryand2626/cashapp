#!/usr/bin/env python3
"""
File migration script - Move existing local files to DigitalOcean Spaces
Run this script to migrate existing uploads to cloud storage
"""

import os
import sys
import asyncio
import logging
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime

# Add backend to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.storage_service import storage_service
from app.core.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class FileMigrator:
    """Handle migration of files from local storage to DigitalOcean Spaces"""
    
    def __init__(self):
        self.base_upload_dir = Path("uploads")
        self.migration_results = []
        
    async def migrate_local_files(self) -> List[Dict[str, Any]]:
        """Migrate all files from local uploads directory to Spaces"""
        
        if not self.base_upload_dir.exists():
            logger.warning(f"Upload directory not found: {self.base_upload_dir}")
            return []
        
        # Define directory mappings
        dir_mappings = {
            'products': 'uploads/products',
            'restaurants': 'uploads/restaurants', 
            'receipts': 'uploads/receipts',
            'profiles': 'uploads/profiles'
        }
        
        results = []
        
        for local_dir, spaces_folder in dir_mappings.items():
            local_path = self.base_upload_dir / local_dir
            
            if local_path.exists():
                logger.info(f"Migrating files from {local_path} to {spaces_folder}")
                dir_results = await self._migrate_directory(local_path, spaces_folder)
                results.extend(dir_results)
            else:
                logger.info(f"Directory not found, skipping: {local_path}")
        
        return results
    
    async def _migrate_directory(self, local_path: Path, spaces_folder: str) -> List[Dict[str, Any]]:
        """Migrate all files in a specific directory"""
        
        results = []
        
        # Get all files in directory
        files = [f for f in local_path.iterdir() if f.is_file()]
        
        if not files:
            logger.info(f"No files found in {local_path}")
            return results
        
        logger.info(f"Found {len(files)} files to migrate in {local_path}")
        
        for file_path in files:
            try:
                result = await self._migrate_single_file(file_path, spaces_folder)
                results.append(result)
                
                # Log progress
                if len(results) % 10 == 0:
                    logger.info(f"Migrated {len(results)} files so far...")
                    
            except Exception as e:
                logger.error(f"Failed to migrate {file_path}: {str(e)}")
                results.append({
                    'local_path': str(file_path),
                    'status': 'failed',
                    'error': str(e),
                    'file_size': file_path.stat().st_size if file_path.exists() else 0
                })
        
        return results
    
    async def _migrate_single_file(self, file_path: Path, spaces_folder: str) -> Dict[str, Any]:
        """Migrate a single file to Spaces"""
        
        logger.debug(f"Migrating: {file_path}")
        
        try:
            # Read file
            with open(file_path, 'rb') as f:
                file_content = f.read()
            
            # Get file info
            file_size = len(file_content)
            filename = file_path.name
            
            # Check if it's a supported file type
            if not self._is_supported_file(filename):
                logger.warning(f"Skipping unsupported file type: {filename}")
                return {
                    'local_path': str(file_path),
                    'status': 'skipped',
                    'reason': 'unsupported_file_type',
                    'file_size': file_size
                }
            
            # Create file-like object for upload
            from io import BytesIO
            file_obj = BytesIO(file_content)
            
            # Upload to Spaces
            upload_result = await storage_service.upload_file(
                file=file_obj,
                filename=filename,
                folder=spaces_folder,
                optimize_image=self._is_image_file(filename)
            )
            
            logger.info(f"✅ Successfully migrated: {file_path} → {upload_result['cdn_url']}")
            
            return {
                'local_path': str(file_path),
                'spaces_path': upload_result['file_path'],
                'cdn_url': upload_result['cdn_url'],
                'spaces_url': upload_result['spaces_url'],
                'status': 'success',
                'file_size': file_size,
                'uploaded_size': upload_result['file_size']
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to migrate {file_path}: {str(e)}")
            raise
    
    def _is_supported_file(self, filename: str) -> bool:
        """Check if file type is supported"""
        allowed_extensions = settings.ALLOWED_FILE_TYPES.split(',')
        file_ext = filename.lower().split('.')[-1]
        return file_ext in allowed_extensions
    
    def _is_image_file(self, filename: str) -> bool:
        """Check if file is an image"""
        image_extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp']
        file_ext = filename.lower().split('.')[-1]
        return file_ext in image_extensions
    
    async def create_backup_list(self) -> Dict[str, Any]:
        """Create a backup list of all files before migration"""
        
        backup_info = {
            'created_at': datetime.now().isoformat(),
            'directories': {},
            'total_files': 0,
            'total_size': 0
        }
        
        dir_mappings = {
            'products': 'uploads/products',
            'restaurants': 'uploads/restaurants',
            'receipts': 'uploads/receipts', 
            'profiles': 'uploads/profiles'
        }
        
        for local_dir, spaces_folder in dir_mappings.items():
            local_path = self.base_upload_dir / local_dir
            
            if local_path.exists():
                files = [f for f in local_path.iterdir() if f.is_file()]
                dir_size = sum(f.stat().st_size for f in files)
                
                backup_info['directories'][local_dir] = {
                    'file_count': len(files),
                    'total_size': dir_size,
                    'files': [
                        {
                            'name': f.name,
                            'size': f.stat().st_size,
                            'modified': f.stat().st_mtime
                        } for f in files
                    ]
                }
                
                backup_info['total_files'] += len(files)
                backup_info['total_size'] += dir_size
        
        return backup_info
    
    def save_migration_report(self, results: List[Dict[str, Any]], backup_info: Dict[str, Any]) -> str:
        """Save migration report to file"""
        
        import json
        
        # Calculate statistics
        successful = [r for r in results if r['status'] == 'success']
        failed = [r for r in results if r['status'] == 'failed']
        skipped = [r for r in results if r['status'] == 'skipped']
        
        total_migrated_size = sum(r.get('file_size', 0) for r in successful)
        
        report = {
            'migration_date': datetime.now().isoformat(),
            'summary': {
                'total_files': len(results),
                'successful': len(successful),
                'failed': len(failed),
                'skipped': len(skipped),
                'total_size_migrated': total_migrated_size,
                'success_rate': len(successful) / len(results) * 100 if results else 0
            },
            'backup_info': backup_info,
            'detailed_results': results
        }
        
        # Save report
        report_filename = f"migration_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        report_path = Path(report_filename)
        
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"Migration report saved to: {report_path}")
        return str(report_path)


async def main():
    """Run file migration"""
    
    logger.info("=" * 60)
    logger.info("FYNLO POS - FILE MIGRATION TO DIGITALOCEAN SPACES")
    logger.info("=" * 60)
    
    # Check if storage service is available
    if not storage_service.enabled:
        logger.error("❌ DigitalOcean Spaces storage is not enabled or configured")
        logger.error("Please check your environment variables:")
        logger.error("- ENABLE_SPACES_STORAGE=true")
        logger.error("- SPACES_ACCESS_KEY_ID")
        logger.error("- SPACES_SECRET_ACCESS_KEY")
        logger.error("- SPACES_BUCKET")
        return 1
    
    # Test connection
    health_check = await storage_service.check_health()
    if health_check['status'] != 'healthy':
        logger.error(f"❌ Spaces connection failed: {health_check['message']}")
        return 1
    
    logger.info(f"✅ Connected to Spaces bucket: {health_check['bucket']}")
    
    # Initialize migrator
    migrator = FileMigrator()
    
    # Create backup list
    logger.info("📋 Creating backup inventory...")
    backup_info = await migrator.create_backup_list()
    
    if backup_info['total_files'] == 0:
        logger.info("ℹ️  No files found to migrate")
        return 0
    
    logger.info(f"📁 Found {backup_info['total_files']} files ({backup_info['total_size'] / (1024*1024):.1f} MB)")
    
    # Confirm migration
    response = input("\n🚀 Proceed with migration? (y/N): ")
    if response.lower() != 'y':
        logger.info("Migration cancelled by user")
        return 0
    
    # Run migration
    logger.info("🔄 Starting file migration...")
    results = await migrator.migrate_local_files()
    
    # Generate report
    report_path = migrator.save_migration_report(results, backup_info)
    
    # Summary
    successful = len([r for r in results if r['status'] == 'success'])
    failed = len([r for r in results if r['status'] == 'failed'])
    skipped = len([r for r in results if r['status'] == 'skipped'])
    
    logger.info("\n" + "=" * 60)
    logger.info("📊 MIGRATION SUMMARY")
    logger.info("=" * 60)
    logger.info(f"Total files processed: {len(results)}")
    logger.info(f"✅ Successful: {successful}")
    logger.info(f"❌ Failed: {failed}")
    logger.info(f"⏭️  Skipped: {skipped}")
    logger.info(f"📈 Success rate: {successful / len(results) * 100:.1f}%" if results else "0%")
    logger.info(f"📄 Report saved: {report_path}")
    
    if failed > 0:
        logger.warning(f"\n⚠️  {failed} files failed to migrate. Check the report for details.")
        return 1
    
    logger.info("\n🎉 Migration completed successfully!")
    logger.info("💡 You can now enable Spaces storage with: ENABLE_SPACES_STORAGE=true")
    
    return 0


if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        logger.info("\n⏸️  Migration interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"💥 Migration failed with error: {str(e)}")
        sys.exit(1)