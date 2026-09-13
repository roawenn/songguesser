/**
 * Yönetim paneli şifresini kurar ya da değiştirir.
 *
 *   npm run admin:parola -- <yeni-parola>
 *
 * ⚠️ KİLİTLENMEYE KARŞI TEK KURTARMA YOLU BUDUR. Şifre artık ortam
 * değişkeninde değil, veritabanında tuzlu scrypt özeti olarak duruyor; panele
 * girilemiyorsa çözüm bu betiği çalıştırmak.
 *
 * ⚠️ Şifre değişince AÇIK OTURUMLARIN HEPSİ kapanır. Çalınmış bir çerezden
 * kurtulmanın yolu da bu.
 */
import { randomBytes, scrypt } from 'node:crypto'
import { promisify } from 'node:util'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

const scryptAsync = promisify(scrypt) as (p: string, t: string, n: number) => Promise<Buffer>

function env(name: string): string {
  const file = join(process.cwd(), '.env.local')
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z_]+)=(.*)$/)
      if (m && m[1] === name && !process.env[name]) process.env[name] = m[2]
    }
  }
  const v = process.env[name]
  if (!v) throw new Error(`${name} tanımlı değil (.env.local)`)
  return v
}

async function main() {
  const parola = process.argv[2]
  if (!parola) {
    console.error('Kullanım: npm run admin:parola -- <yeni-parola>')
    process.exit(1)
  }
  if (parola.length < 12) {
    // Kaba kuvvete karşı hız sınırı var ama ilk savunma hâlâ şifrenin kendisi.
    console.error('Şifre en az 12 karakter olmalı.')
    process.exit(1)
  }

  const client = new pg.Client({
    connectionString: env('SUPABASE_DB_URL'),
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  const tuz = randomBytes(16).toString('hex')
  const hash = (await scryptAsync(parola, tuz, 64)).toString('hex')

  await client.query(
    `insert into public.admin_hesap (id, parola_hash, tuz, guncellendi)
     values (1, $1, $2, now())
     on conflict (id) do update
       set parola_hash = excluded.parola_hash,
           tuz = excluded.tuz,
           guncellendi = now()`,
    [hash, tuz],
  )

  const kapanan = await client.query('delete from public.admin_oturum')
  console.log('Şifre güncellendi.')
  console.log(`Açık oturum kapatıldı: ${kapanan.rowCount}`)

  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
