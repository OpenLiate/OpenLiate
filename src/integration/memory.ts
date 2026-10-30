import fs from "fs/promises";
import path from "path";
import type { AgentMessage, MemoryProvider, SessionData } from "./types";

export class InMemorySession implements MemoryProvider {
  public readonly sessionId: string;
  private data: SessionData;

  constructor(sessionId: string = "default", metadata?: Record<string, any>) {
    this.sessionId = sessionId;
    const now = new Date().toISOString();
    this.data = {
      sessionId,
      createdAt: now,
      updatedAt: now,
      metadata: metadata || {},
      messages: [],
      state: {}
    };
  }

  public async load(): Promise<SessionData> {
    return this.data;
  }

  public async save(): Promise<void> {
    this.data.updatedAt = new Date().toISOString();
  }

  public getMessages(): AgentMessage[] {
    return [...this.data.messages];
  }

  public async append(message: AgentMessage | AgentMessage[]): Promise<void> {
    const list = Array.isArray(message) ? message : [message];
    for (const msg of list) {
      this.data.messages.push({
        ...msg,
        timestamp: msg.timestamp ?? Date.now()
      });
    }
    await this.save();
  }

  public getState(key: string): any {
    return this.data.state[key];
  }

  public async setState(key: string, value: any): Promise<void> {
    this.data.state[key] = value;
    await this.save();
  }

  public async clear(): Promise<void> {
    this.data.messages = [];
    this.data.state = {};
    await this.save();
  }
}

export class FileSessionMemory implements MemoryProvider {
  public readonly sessionId: string;
  public readonly filePath: string;
  private data: SessionData;
  private loaded: boolean = false;

  constructor(filePath: string, metadata?: Record<string, any>) {
    const normalized = filePath.endsWith(".json") ? filePath : `${filePath}.json`;
    this.filePath = path.isAbsolute(normalized) ? normalized : path.resolve(process.cwd(), normalized);
    this.sessionId = path.basename(this.filePath, ".json");

    const now = new Date().toISOString();
    this.data = {
      sessionId: this.sessionId,
      createdAt: now,
      updatedAt: now,
      metadata: metadata || {},
      messages: [],
      state: {}
    };
  }

  public async load(): Promise<SessionData> {
    try {
      const content = await fs.readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(content);
      this.data = {
        sessionId: parsed.sessionId || this.sessionId,
        createdAt: parsed.createdAt || this.data.createdAt,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        metadata: { ...(this.data.metadata || {}), ...(parsed.metadata || {}) },
        messages: Array.isArray(parsed.messages) ? parsed.messages : [],
        state: parsed.state && typeof parsed.state === "object" ? parsed.state : {}
      };
      this.loaded = true;
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        throw new Error(`Failed to load session memory from ${this.filePath}: ${err.message}`);
      }
      // If file does not exist yet, initialize it
      await this.save();
      this.loaded = true;
    }
    return this.data;
  }

  public async save(): Promise<void> {
    this.data.updatedAt = new Date().toISOString();
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
  }

  public getMessages(): AgentMessage[] {
    return [...this.data.messages];
  }

  public async append(message: AgentMessage | AgentMessage[]): Promise<void> {
    if (!this.loaded) {
      await this.load();
    }
    const list = Array.isArray(message) ? message : [message];
    for (const msg of list) {
      this.data.messages.push({
        ...msg,
        timestamp: msg.timestamp ?? Date.now()
      });
    }
    await this.save();
  }

  public getState(key: string): any {
    return this.data.state[key];
  }

  public async setState(key: string, value: any): Promise<void> {
    if (!this.loaded) {
      await this.load();
    }
    this.data.state[key] = value;
    await this.save();
  }

  public async clear(): Promise<void> {
    this.data.messages = [];
    this.data.state = {};
    await this.save();
  }
}
