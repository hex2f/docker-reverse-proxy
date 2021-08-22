import http from 'http'
import ContainerManager from './container-manager'

export default class HTTPServer {
  private readonly server: http.Server

  constructor (private readonly containers: ContainerManager, private readonly port: number) {
    this.server = http.createServer(this.handler.bind(this))
    this.listen()
  }

  async handler (req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (req.headers.host === undefined) {
      res.statusCode = 400
      res.end('Missing host header')
      return
    }

    const [host, port] = (req.headers.host as string).split(':')
    const ip = this.containers.hostMap.get(host)

    if (ip === undefined) {
      res.statusCode = 404
      res.end('Host not found')
      return
    }

    const proxiedRequest = http.request({
      host: ip,
      port: 80,
      method: req.method,
      path: req.url,
      headers: req.headers
    })

    proxiedRequest.on('connect', () => {
      req.pipe(proxiedRequest)
    })

    proxiedRequest.on('response', (response: http.IncomingMessage) => {
      res.writeHead(response.statusCode ?? 200, response.headers)
      response.pipe(res)
    })

    proxiedRequest.on('error', () => {
      res.statusCode = 504
      res.end('Request timed out')
    })

    proxiedRequest.on('timeout', () => {
      res.statusCode = 504
      res.end('Request timed out')
    })
  }

  listen (): void {
    this.server.listen(this.port)
  }

  public close (): void {
    this.server.close()
  }
}
