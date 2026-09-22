import { StatementMetadata } from '../types/statement';
import { logger } from '../utils/logger';

export class StatementRepository {
  private static store: Map<string, StatementMetadata> = new Map();

  public static async save(metadata: StatementMetadata): Promise<void> {
    this.store.set(metadata.documentId, metadata);
    logger.info({
      requestId: metadata.requestId,
      stage: 'STORAGE_SAVED',
      documentId: metadata.documentId,
      status: metadata.processingStatus,
      durationMs: metadata.processingDurationMs,
    });
  }

  public static async getById(documentId: string): Promise<StatementMetadata | undefined> {
    return this.store.get(documentId);
  }

  public static async list(limit: number = 20): Promise<StatementMetadata[]> {
    return Array.from(this.store.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  public static async clear(): Promise<void> {
    this.store.clear();
  }
}
