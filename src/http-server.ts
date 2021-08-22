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
    const ip = this.containers.resolveIP(host)
    if (ip === undefined) {
      res.writeHead(404)
      res.end()
      return
    }
    const ricochet = http.request({
      host: ip,
      port: 80,
      path: req.url,
      method: req.method,
      headers: req.headers
    }, (response) => {
      res.writeHead(response.statusCode ?? 200, response.headers)
      response.pipe(res)
    })
    
    req.pipe(ricochet)

    ricochet.on('error', () => {
      res.statusCode = 504
      res.end('Request timed out')
    })

    ricochet.on('timeout', () => {
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
