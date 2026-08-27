import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from './schema' // Impor seluruh isi skema dari folder schema

// Konfigurasi koneksi LibSQL lokal
const client = createClient({
  url: process.env.DATABASE_URL || 'file:.data/maukaga.db',
})

// Inisialisasi Drizzle dengan meneruskan objek schema (yang sudah mencakup tabel & appRelations)
export const db = drizzle(client, { schema })