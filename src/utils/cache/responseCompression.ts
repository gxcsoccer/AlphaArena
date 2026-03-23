/**
 * Response Compression Middleware - API 响应压缩
 * 
 * Compresses API responses using gzip/deflate to:
 * - Reduce bandwidth usage
 * - Improve response times for large payloads
 * - Support different compression algorithms
 */

import { Request, Response, NextFunction } from 'express';
import zlib from 'zlib';
import { createLogger } from '../logger';

const log = createLogger('ResponseCompression');

/**
 * Compression threshold - only compress responses larger than this
 */
const COMPRESSION_THRESHOLD = 1024; // 1KB

/**
 * Supported compression algorithms
 */
type CompressionAlgorithm = 'gzip' | 'deflate' | 'identity';

/**
 * Check if compression is supported and desired
 */
function shouldCompress(req: Request, res: Response): boolean {
  // Don't compress if client doesn't support it
  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (!acceptEncoding.includes('gzip') && !acceptEncoding.includes('deflate')) {
    return false;
  }

  // Don't compress if response is too small (will be checked after content is generated)
  // Don't compress if already compressed
  if (res.getHeader('Content-Encoding')) {
    return false;
  }

  // Don't compress images, videos, or other already-compressed content
  const contentType = res.getHeader('Content-Type') as string;
  if (contentType) {
    const noCompressTypes = [
      'image/', 'video/', 'audio/', 'application/pdf',
      'application/zip', 'application/gzip',
      'application/octet-stream',
    ];
    if (noCompressTypes.some(type => contentType.includes(type))) {
      return false;
    }
  }

  return true;
}

/**
 * Get preferred compression algorithm
 */
function getPreferredAlgorithm(req: Request): CompressionAlgorithm {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  
  // Prefer gzip over deflate
  if (acceptEncoding.includes('gzip')) {
    return 'gzip';
  }
  if (acceptEncoding.includes('deflate')) {
    return 'deflate';
  }
  return 'identity';
}

/**
 * Compress data using specified algorithm
 */
function compressData(data: Buffer, algorithm: CompressionAlgorithm): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (algorithm === 'identity') {
      resolve(data);
      return;
    }

    const compressor = algorithm === 'gzip' 
      ? zlib.gzip 
      : zlib.deflate;

    compressor(data, (err, compressed) => {
      if (err) {
        reject(err);
      } else {
        resolve(compressed);
      }
    });
  });
}

/**
 * Response compression middleware factory
 */
export function responseCompressionMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if response should be compressed
    if (!shouldCompress(req, res)) {
      next();
      return;
    }

    const algorithm = getPreferredAlgorithm(req);
    
    if (algorithm === 'identity') {
      next();
      return;
    }

    // Store original methods
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);
    
    // Buffer to collect response data
    const chunks: Buffer[] = [];
    let isCompressing = true;

    // Override write method
    res.write = (chunk: any, ...args: any[]): boolean => {
      if (!isCompressing) {
        return originalWrite(chunk, ...args);
      }
      
      if (chunk) {
        if (typeof chunk === 'string') {
          chunks.push(Buffer.from(chunk));
        } else if (Buffer.isBuffer(chunk)) {
          chunks.push(chunk);
        }
      }
      return true;
    };

    // Override end method
    res.end = (chunk: any, ...args: any[]): Response => {
      if (!isCompressing) {
        return originalEnd(chunk, ...args);
      }

      if (chunk) {
        if (typeof chunk === 'string') {
          chunks.push(Buffer.from(chunk));
        } else if (Buffer.isBuffer(chunk)) {
          chunks.push(chunk);
        }
      }

      // Combine all chunks
      const data = Buffer.concat(chunks);

      // Check if response is large enough to compress
      if (data.length < COMPRESSION_THRESHOLD) {
        res.removeHeader('Content-Encoding');
        return originalEnd(data);
      }

      // Compress the data
      compressData(data, algorithm)
        .then((compressed) => {
          // Only use compression if it actually reduces size
          if (compressed.length >= data.length) {
            log.debug(`Compression not beneficial for ${req.path} (${data.length} bytes)`);
            res.removeHeader('Content-Encoding');
            return originalEnd(data);
          }

          log.debug(`Compressed ${req.path}: ${data.length} -> ${compressed.length} bytes (${Math.round((1 - compressed.length / data.length) * 100)}% reduction)`);
          
          res.setHeader('Content-Encoding', algorithm);
          res.setHeader('Vary', 'Accept-Encoding');
          
          // Remove Content-Length header as it will change
          res.removeHeader('Content-Length');
          
          originalEnd(compressed);
        })
        .catch((err) => {
          log.error(`Compression error: ${err.message}`);
          // Fall back to uncompressed
          res.removeHeader('Content-Encoding');
          originalEnd(data);
        });

      return res;
    };

    // Set Vary header for caching
    res.setHeader('Vary', 'Accept-Encoding');

    next();
  };
}

/**
 * Compression statistics middleware
 */
export interface CompressionStats {
  totalRequests: number;
  compressedRequests: number;
  totalBytesIn: number;
  totalBytesOut: number;
  averageCompressionRatio: number;
}

const compressionStats: CompressionStats = {
  totalRequests: 0,
  compressedRequests: 0,
  totalBytesIn: 0,
  totalBytesOut: 0,
  averageCompressionRatio: 0,
};

/**
 * Get compression statistics
 */
export function getCompressionStats(): CompressionStats {
  return { ...compressionStats };
}

/**
 * Reset compression statistics
 */
export function resetCompressionStats(): void {
  compressionStats.totalRequests = 0;
  compressionStats.compressedRequests = 0;
  compressionStats.totalBytesIn = 0;
  compressionStats.totalBytesOut = 0;
  compressionStats.averageCompressionRatio = 0;
}

export default responseCompressionMiddleware;