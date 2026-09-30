import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { AppError } from './errors';
import { record, string, validateEndpoint } from './settings';

export interface SecretProtector {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}

export class Credentials {
  constructor(
    private readonly path: string,
    private readonly protector: SecretProtector,
  ) {}

  private id(endpoint: unknown): string {
    return createHash('sha256').update(validateEndpoint(endpoint)).digest('hex');
  }

  private read(): Record<string, string> {
    let text: string;
    try {
      text = readFileSync(this.path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
      throw new AppError('credentials', '无法读取密钥密文文件，请检查数据目录权限。');
    }
    try {
      const data = record(JSON.parse(text));
      if (
        Object.entries(data).some(
          ([key, value]) =>
            !/^[a-f0-9]{64}$/.test(key) ||
            typeof value !== 'string' ||
            !/^[A-Za-z0-9+/]+={0,2}$/.test(value),
        )
      )
        throw new Error('Invalid credential data');
      return data as Record<string, string>;
    } catch {
      throw new AppError('credentials', '密钥密文文件损坏，请保留文件并重新配置密钥。');
    }
  }

  private write(data: Record<string, string>): void {
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporary, JSON.stringify(data), { mode: 0o600 });
      renameSync(temporary, this.path);
    } catch {
      throw new AppError('credentials', '密钥密文保存失败，请检查磁盘空间和数据目录权限。');
    }
  }

  has(endpoint: unknown): boolean {
    return this.read()[this.id(endpoint)] !== undefined;
  }

  load(endpoint: unknown): string | undefined {
    const value = this.read()[this.id(endpoint)];
    if (value === undefined) return undefined;
    if (!this.protector.isEncryptionAvailable())
      throw new AppError('credentials', 'Windows 系统加密暂时不可用，请重试。');
    try {
      return this.protector.decryptString(Buffer.from(value, 'base64'));
    } catch {
      throw new AppError(
        'credentials',
        '无法解密密钥。请在原 Windows 账户中打开，或重新配置此地址的密钥。',
      );
    }
  }

  store(endpoint: unknown, input: unknown): void {
    const id = this.id(endpoint);
    const key = string(input, '密钥', 4096);
    if (!key || /[\r\n]/.test(key))
      throw new AppError('validation', '密钥为空或包含换行，请检查填写内容。');
    if (!this.protector.isEncryptionAvailable())
      throw new AppError('credentials', 'Windows 系统加密不可用，未保存密钥。');
    let cipher: Buffer;
    try {
      cipher = this.protector.encryptString(key);
    } catch {
      throw new AppError('credentials', 'Windows 系统加密失败，未保存密钥。');
    }
    this.write({ ...this.read(), [id]: cipher.toString('base64') });
  }

  remove(endpoint: unknown): void {
    const id = this.id(endpoint);
    const data = this.read();
    delete data[id];
    this.write(data);
  }
}
