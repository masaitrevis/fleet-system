import { Router, Request, Response } from 'express';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth';
import { upload, optimizeImage, deleteImage, handleUploadError } from '../middleware/upload';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Apply authentication to all photo routes
router.use(authenticateToken);

// ==================== AUDIT PHOTO ROUTES ====================

/**
 * Upload photo for audit question
 * POST /photos/audit/:auditId/question/:questionId
 */
router.post(
  '/audit/:auditId/question/:questionId',
  upload.single('photo'),
  handleUploadError,
  asyncHandler(async (req: any, res: Response) => {
    const { auditId, questionId } = req.params;
    const { issueType, notes, auditSessionId } = req.body;
    const userId = req.user?.id;
    const companyId = req.user?.companyId;

    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }

    // Validate issue type requires photo
    const requiresPhoto = ['Issue', 'Fail', 'Non-compliant', 'Critical'].includes(issueType);
    if (!requiresPhoto) {
      return res.status(400).json({ 
        error: 'Photos are only required for Issue, Fail, Non-compliant, or Critical responses' 
      });
    }

    // Optimize and save image
    const optimized = await optimizeImage(
      req.file.buffer,
      req.file.originalname,
      companyId
    );

    // Save to database
    const photoId = uuidv4();
    await query(`
      INSERT INTO audit_photos (
        id, audit_id, audit_session_id, question_id, image_url, thumbnail_url,
        file_size, mime_type, uploaded_by, company_id, issue_type, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      photoId,
      auditId,
      auditSessionId || null,
      questionId,
      optimized.imageUrl,
      optimized.thumbnailUrl,
      optimized.fileSize,
      optimized.mimeType,
      userId,
      companyId,
      issueType,
      notes
    ]);

    res.status(201).json({
      id: photoId,
      imageUrl: optimized.imageUrl,
      thumbnailUrl: optimized.thumbnailUrl,
      message: 'Photo uploaded successfully'
    });
  })
);

/**
 * Get all photos for an audit
 * GET /photos/audit/:auditId
 */
router.get(
  '/audit/:auditId',
  asyncHandler(async (req: any, res: Response) => {
    const { auditId } = req.params;
    const companyId = req.user?.companyId;
    const userRole = req.user?.role;

    let sql = `
      SELECT 
        ap.*,
        u.email as uploaded_by_email,
        aq.question_text
      FROM audit_photos ap
      LEFT JOIN users u ON u.id = ap.uploaded_by
      LEFT JOIN audit_questions aq ON aq.id = ap.question_id
      WHERE ap.audit_id = $1
    `;
    const params: any[] = [auditId];

    // Non-admin users can only see their company's photos
    if (userRole !== 'admin' && companyId) {
      sql += ` AND (ap.company_id = $2 OR ap.company_id IS NULL)`;
      params.push(companyId);
    }

    sql += ` ORDER BY ap.created_at DESC`;

    const photos = await query(sql, params);
    res.json(photos);
  })
);

/**
 * Get photos for a specific audit question
 * GET /photos/audit/:auditId/question/:questionId
 */
router.get(
  '/audit/:auditId/question/:questionId',
  asyncHandler(async (req: any, res: Response) => {
    const { auditId, questionId } = req.params;
    const companyId = req.user?.companyId;
    const userRole = req.user?.role;

    let sql = `
      SELECT 
        ap.*,
        u.email as uploaded_by_email
      FROM audit_photos ap
      LEFT JOIN users u ON u.id = ap.uploaded_by
      WHERE ap.audit_id = $1 AND ap.question_id = $2
    `;
    const params: any[] = [auditId, questionId];

    if (userRole !== 'admin' && companyId) {
      sql += ` AND (ap.company_id = $3 OR ap.company_id IS NULL)`;
      params.push(companyId);
    }

    sql += ` ORDER BY ap.created_at DESC`;

    const photos = await query(sql, params);
    res.json(photos);
  })
);

/**
 * Delete an audit photo
 * DELETE /photos/audit/:photoId
 */
router.delete(
  '/audit/:photoId',
  asyncHandler(async (req: any, res: Response) => {
    const { photoId } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const companyId = req.user?.companyId;

    // Get photo details
    let sql = `SELECT * FROM audit_photos WHERE id = $1`;
    const params: any[] = [photoId];

    if (userRole !== 'admin' && companyId) {
      sql += ` AND (company_id = $2 OR company_id IS NULL)`;
      params.push(companyId);
    }

    const photos = await query(sql, params);
    
    if (photos.length === 0) {
      return res.status(404).json({ error: 'Photo not found or access denied' });
    }

    const photo = photos[0];

    // Only admin, owner, or manager can delete
    if (userRole !== 'admin' && photo.uploaded_by !== userId && !['manager', 'fleet_manager'].includes(userRole)) {
      return res.status(403).json({ error: 'Not authorized to delete this photo' });
    }

    // Delete from storage
    await deleteImage(photo.image_url);

    // Delete from database
    await query(`DELETE FROM audit_photos WHERE id = $1`, [photoId]);

    res.json({ message: 'Photo deleted successfully' });
  })
);

// ==================== INSPECTION PHOTO ROUTES ====================

/**
 * Upload photo for inspection
 * POST /photos/inspection/:inspectionId
 */
router.post(
  '/inspection/:inspectionId',
  upload.single('photo'),
  handleUploadError,
  asyncHandler(async (req: any, res: Response) => {
    const { inspectionId } = req.params;
    const { issueDescription, severity, jobCardId } = req.body;
    const userId = req.user?.id;
    const companyId = req.user?.companyId;

    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }

    // Optimize and save image
    const optimized = await optimizeImage(
      req.file.buffer,
      req.file.originalname,
      companyId
    );

    // Save to database
    const photoId = uuidv4();
    await query(`
      INSERT INTO inspection_photos (
        id, inspection_id, job_card_id, image_url, thumbnail_url,
        file_size, mime_type, issue_description, severity,
        uploaded_by, company_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      photoId,
      inspectionId,
      jobCardId || null,
      optimized.imageUrl,
      optimized.thumbnailUrl,
      optimized.fileSize,
      optimized.mimeType,
      issueDescription,
      severity || 'medium',
      userId,
      companyId
    ]);

    res.status(201).json({
      id: photoId,
      imageUrl: optimized.imageUrl,
      thumbnailUrl: optimized.thumbnailUrl,
      message: 'Photo uploaded successfully'
    });
  })
);

/**
 * Upload multiple photos for inspection
 * POST /photos/inspection/:inspectionId/batch
 */
router.post(
  '/inspection/:inspectionId/batch',
  upload.array('photos', 5),
  handleUploadError,
  asyncHandler(async (req: any, res: Response) => {
    const { inspectionId } = req.params;
    const { issueDescription, severity, jobCardId } = req.body;
    const userId = req.user?.id;
    const companyId = req.user?.companyId;

    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      return res.status(400).json({ error: 'No photos uploaded' });
    }

    const files = req.files as Express.Multer.File[];
    const uploadedPhotos = [];

    for (const file of files) {
      // Optimize and save image
      const optimized = await optimizeImage(
        file.buffer,
        file.originalname,
        companyId
      );

      // Save to database
      const photoId = uuidv4();
      await query(`
        INSERT INTO inspection_photos (
          id, inspection_id, job_card_id, image_url, thumbnail_url,
          file_size, mime_type, issue_description, severity,
          uploaded_by, company_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        photoId,
        inspectionId,
        jobCardId || null,
        optimized.imageUrl,
        optimized.thumbnailUrl,
        optimized.fileSize,
        optimized.mimeType,
        issueDescription,
        severity || 'medium',
        userId,
        companyId
      ]);

      uploadedPhotos.push({
        id: photoId,
        imageUrl: optimized.imageUrl,
        thumbnailUrl: optimized.thumbnailUrl
      });
    }

    res.status(201).json({
      photos: uploadedPhotos,
      count: uploadedPhotos.length,
      message: 'Photos uploaded successfully'
    });
  })
);

/**
 * Get all photos for an inspection
 * GET /photos/inspection/:inspectionId
 */
router.get(
  '/inspection/:inspectionId',
  asyncHandler(async (req: any, res: Response) => {
    const { inspectionId } = req.params;
    const companyId = req.user?.companyId;
    const userRole = req.user?.role;

    let sql = `
      SELECT 
        ip.*,
        u.email as uploaded_by_email
      FROM inspection_photos ip
      LEFT JOIN users u ON u.id = ip.uploaded_by
      WHERE ip.inspection_id = $1
    `;
    const params: any[] = [inspectionId];

    if (userRole !== 'admin' && companyId) {
      sql += ` AND (ip.company_id = $2 OR ip.company_id IS NULL)`;
      params.push(companyId);
    }

    sql += ` ORDER BY ip.created_at DESC`;

    const photos = await query(sql, params);
    res.json(photos);
  })
);

/**
 * Delete an inspection photo
 * DELETE /photos/inspection/:photoId
 */
router.delete(
  '/inspection/:photoId',
  asyncHandler(async (req: any, res: Response) => {
    const { photoId } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const companyId = req.user?.companyId;

    // Get photo details
    let sql = `SELECT * FROM inspection_photos WHERE id = $1`;
    const params: any[] = [photoId];

    if (userRole !== 'admin' && companyId) {
      sql += ` AND (company_id = $2 OR company_id IS NULL)`;
      params.push(companyId);
    }

    const photos = await query(sql, params);
    
    if (photos.length === 0) {
      return res.status(404).json({ error: 'Photo not found or access denied' });
    }

    const photo = photos[0];

    // Only admin, owner, or manager can delete
    if (userRole !== 'admin' && photo.uploaded_by !== userId && !['manager', 'fleet_manager'].includes(userRole)) {
      return res.status(403).json({ error: 'Not authorized to delete this photo' });
    }

    // Delete from storage
    await deleteImage(photo.image_url);

    // Delete from database
    await query(`DELETE FROM inspection_photos WHERE id = $1`, [photoId]);

    res.json({ message: 'Photo deleted successfully' });
  })
);

// ==================== GENERAL PHOTO ROUTES ====================

/**
 * Get photo statistics for dashboard
 * GET /photos/stats
 */
router.get(
  '/stats',
  asyncHandler(async (req: any, res: Response) => {
    const companyId = req.user?.companyId;
    const userRole = req.user?.role;

    let auditSql = `SELECT COUNT(*) as count FROM audit_photos WHERE 1=1`;
    let inspectionSql = `SELECT COUNT(*) as count FROM inspection_photos WHERE 1=1`;
    const params: any[] = [];

    if (userRole !== 'admin' && companyId) {
      auditSql += ` AND (company_id = $1 OR company_id IS NULL)`;
      inspectionSql += ` AND (company_id = $1 OR company_id IS NULL)`;
      params.push(companyId);
    }

    const [auditResult, inspectionResult] = await Promise.all([
      query(auditSql, params),
      query(inspectionSql, params)
    ]);

    // Get recent photos
    let recentSql = `
      (SELECT 'audit' as type, id, image_url, thumbnail_url, created_at, issue_type as description
       FROM audit_photos
    `;
    
    if (userRole !== 'admin' && companyId) {
      recentSql += ` WHERE company_id = $1 OR company_id IS NULL`;
    }
    
    recentSql += `)
      UNION ALL
      (SELECT 'inspection' as type, id, image_url, thumbnail_url, created_at, issue_description as description
       FROM inspection_photos
    `;
    
    if (userRole !== 'admin' && companyId) {
      recentSql += ` WHERE company_id = $1 OR company_id IS NULL`;
    }
    
    recentSql += `)
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const recentPhotos = await query(recentSql, companyId && userRole !== 'admin' ? [companyId] : []);

    res.json({
      auditPhotos: parseInt(auditResult[0]?.count || 0),
      inspectionPhotos: parseInt(inspectionResult[0]?.count || 0),
      totalPhotos: parseInt(auditResult[0]?.count || 0) + parseInt(inspectionResult[0]?.count || 0),
      recentPhotos
    });
  })
);

export default router;
