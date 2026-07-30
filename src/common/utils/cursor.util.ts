export class CursorUtil {
  /**
   * Encodes createdAt and id into a Base64 string
   */
  static encode(createdAt: Date, id: string | number): string {
    const payload = `${createdAt.getTime()}_${id}`;
    return Buffer.from(payload).toString('base64');
  }

  /**
   * Decodes a Base64 cursor back into createdAt and id
   */
  static decode(cursor: string): { createdAt: Date; id: string } | null {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('ascii');
      const [timestamp, id] = decoded.split('_');
      
      if (!timestamp || !id) return null;
      
      return {
        createdAt: new Date(parseInt(timestamp, 10)),
        id,
      };
    } catch (e) {
      return null;
    }
  }
}