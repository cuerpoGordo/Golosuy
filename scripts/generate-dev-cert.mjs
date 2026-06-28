import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const certDir = path.join(rootDir, 'certs')
const keyPath = path.join(certDir, 'dev-key.pem')
const certPath = path.join(certDir, 'dev-cert.pem')
const configPath = path.join(certDir, 'openssl.cnf')
const metaPath = path.join(certDir, 'san.json')

function getLocalIpv4Addresses() {
  const addresses = new Set(['127.0.0.1'])

  try {
    for (const entries of Object.values(os.networkInterfaces())) {
      for (const entry of entries ?? []) {
        if (entry.family === 'IPv4' && !entry.internal) {
          addresses.add(entry.address)
        }
      }
    }
  } catch {
    // В ограниченных окружениях networkInterfaces может быть недоступен.
  }

  for (const ip of process.env.GOLOSUY_DEV_IPS?.split(',') ?? []) {
    const trimmed = ip.trim()
    if (trimmed) {
      addresses.add(trimmed)
    }
  }

  return [...addresses].sort()
}

function buildOpenSslConfig(ips) {
  const sanParts = ['DNS:localhost', ...ips.map((ip) => `IP:${ip}`)]

  return `[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
CN = Golosuy Dev

[v3_req]
subjectAltName = ${sanParts.join(',')}
`
}

function shouldRegenerate(force) {
  if (force) {
    return true
  }

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    return true
  }

  if (!fs.existsSync(metaPath)) {
    return true
  }

  const saved = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
  const current = getLocalIpv4Addresses()

  return JSON.stringify(saved) !== JSON.stringify(current)
}

function generateCerts() {
  const ips = getLocalIpv4Addresses()

  fs.mkdirSync(certDir, { recursive: true })
  fs.writeFileSync(configPath, buildOpenSslConfig(ips))

  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-keyout',
      keyPath,
      '-out',
      certPath,
      '-days',
      '365',
      '-nodes',
      '-config',
      configPath,
    ],
    { stdio: 'inherit', cwd: rootDir },
  )

  fs.writeFileSync(metaPath, JSON.stringify(ips))
  console.log(`Dev-сертификат: localhost, ${ips.join(', ')}`)
}

const force = process.argv.includes('--force')

if (shouldRegenerate(force)) {
  generateCerts()
} else {
  const ips = getLocalIpv4Addresses()
  console.log(`Dev-сертификат актуален: localhost, ${ips.join(', ')}`)
}
