const GOATCOUNTER_ENDPOINT = 'https://cuerpogordo.goatcounter.com/count'
const GOATCOUNTER_SCRIPT = 'https://gc.zgo.at/count.js'

/** GoatCounter: только pageview, без cookies. Подключается только в production. */
export function initAnalytics(): void {
  if (!import.meta.env.PROD) {
    return
  }

  if (document.getElementById('golosuy-goatcounter')) {
    return
  }

  const script = document.createElement('script')
  script.id = 'golosuy-goatcounter'
  script.async = true
  script.dataset.goatcounter = GOATCOUNTER_ENDPOINT
  script.src = GOATCOUNTER_SCRIPT

  document.head.appendChild(script)
}
