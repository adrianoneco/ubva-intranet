import { tasks, categories, cards, contacts, departments, setores, companies, type Task, type InsertTask, type Category, type InsertCategory, type Card, type InsertCard } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Task methods
  getAllTasks(): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<void>;
  
  // Category methods
  getAllCategories(): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  // Card methods
  getAllCards(): Promise<Card[]>;
  getCard(id: number): Promise<Card | undefined>;
  createCard(card: InsertCard): Promise<Card>;
  updateCard(id: number, card: Partial<InsertCard>): Promise<Card | undefined>;
  deleteCard(id: number): Promise<void>;
  // Contacts methods
  getContactsByKind(kind: string): Promise<any[]>;
  insertContacts(kind: string, items: any[]): Promise<any[]>;
  createContact(item: any): Promise<any>;
  updateContact(id: number, item: Partial<any>): Promise<any | undefined>;
  deleteContact(id: number): Promise<void>;
  // Lookup methods for normalized tables
  getDepartments(): Promise<any[]>;
  getSetores(): Promise<any[]>;
  getCompanies(): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // Task methods
  async getAllTasks(): Promise<Task[]> {
    return await db.select().from(tasks).orderBy(tasks.createdAt);
  }

  async getTask(id: number): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task || undefined;
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const [task] = await db
      .insert(tasks)
      .values(insertTask)
      .returning();
    return task;
  }

  async updateTask(id: number, taskUpdate: Partial<InsertTask>): Promise<Task | undefined> {
    const [task] = await db
      .update(tasks)
      .set(taskUpdate)
      .where(eq(tasks.id, id))
      .returning();
    return task || undefined;
  }

  async deleteTask(id: number): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  // Category methods
  async getAllCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category || undefined;
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db
      .insert(categories)
      .values(insertCategory)
      .returning();
    return category;
  }

  // Card methods
  async getAllCards(): Promise<Card[]> {
    return await db.select().from(cards).orderBy(cards.createdAt);
  }

  async getCard(id: number): Promise<Card | undefined> {
    const [card] = await db.select().from(cards).where(eq(cards.id, id));
    return card || undefined;
  }

  async createCard(insertCard: InsertCard): Promise<Card> {
    const [card] = await db
      .insert(cards)
      .values(insertCard)
      .returning();
    return card;
  }

  async updateCard(id: number, cardUpdate: Partial<InsertCard>): Promise<Card | undefined> {
    const [card] = await db
      .update(cards)
      .set(cardUpdate)
      .where(eq(cards.id, id))
      .returning();
    return card || undefined;
  }

  async deleteCard(id: number): Promise<void> {
    await db.delete(cards).where(eq(cards.id, id));
  }

  // Contacts methods
  async getContactsByKind(kind: string): Promise<any[]> {
    return await db.select().from(contacts).where(eq(contacts.kind, kind)).orderBy(contacts.id);
  }

  // Lookup methods
  async getDepartments(): Promise<any[]> {
    return await db.select().from(departments).orderBy(departments.name);
  }

  async getSetores(): Promise<any[]> {
    return await db.select().from(setores).orderBy(setores.name);
  }

  async getCompanies(): Promise<any[]> {
    return await db.select().from(companies).orderBy(companies.name);
  }

  // Update only the email field for a contact by id
  async updateContactEmail(id: number, email: string | null): Promise<any | undefined> {
    const [row] = await db.update(contacts).set({ email }).where(eq(contacts.id, id)).returning();
    return row || undefined;
  }

  // (replaceContacts removed) use `insertContacts`, `createContact`, `updateContact`, `deleteContact` instead.

  // Insert contacts without deleting existing rows. Returns inserted rows.
  async insertContacts(kind: string, items: any[]): Promise<any[]> {
    if (!items || items.length === 0) return [];
    const rows = items.map((it: any) => ({
      kind,
      name: it.name || (it.title || ''),
      number: it.number || null,
      department: it.department || null,
      setor: it.setor || null,
      company: (typeof it.company === 'string' ? it.company : ''),
      email: it.email || null,
      image: it.image || null,
      rocketUser: it.rocketUser || it.rocket_user || null,
      whatsapp: it.whatsapp || it.whatsApp || null,
    }));
    const inserted = await db.insert(contacts).values(rows).returning();
    try { console.log(`storage.insertContacts: inserted ${inserted.length} rows for kind='${kind}'`); } catch (e) {}
    return inserted;
  }

  async createContact(item: any): Promise<any> {
    const row = {
      kind: item.kind || 'ramais',
      name: item.name || '',
      number: item.number || null,
      department: item.department || null,
      setor: item.setor || null,
      company: item.company || '',
      image: item.image || null,
      email: item.email || null,
      rocketUser: item.rocketUser || item.rocket_user || null,
      whatsapp: item.whatsapp || null,
    };
    const [created] = await db.insert(contacts).values(row).returning();
    return created;
  }

  async updateContact(id: number, item: Partial<any>): Promise<any | undefined> {
    const payload: any = {};
    if (typeof item.name !== 'undefined') payload.name = item.name;
    if (typeof item.number !== 'undefined') payload.number = item.number;
    if (typeof item.department !== 'undefined') payload.department = item.department;
    if (typeof item.setor !== 'undefined') payload.setor = item.setor;
    if (typeof item.company !== 'undefined') payload.company = item.company;
    if (typeof item.image !== 'undefined') payload.image = item.image;
    if (typeof item.email !== 'undefined') payload.email = item.email;
    if (typeof item.rocketUser !== 'undefined') payload.rocketUser = item.rocketUser;
    if (typeof item.whatsapp !== 'undefined') payload.whatsapp = item.whatsapp;
    if (Object.keys(payload).length === 0) return undefined;
    const [row] = await db.update(contacts).set(payload).where(eq(contacts.id, id)).returning();
    return row || undefined;
  }

  async deleteContact(id: number): Promise<void> {
    await db.delete(contacts).where(eq(contacts.id, id));
  }
}

export const storage = new DatabaseStorage();
