import Dockerode, { Container } from 'dockerode'
import YAML from 'yaml'
import fs from 'fs'
import log from './log'
import { exec as CPExec } from 'child_process'
import { promisify } from 'util'
const exec = promisify(CPExec)

interface ContainerConfig {
  hostnames: string[]
  ssh_keys: string[]
}

export default class ContainerManager {
  containerConfigs: Map<string, ContainerConfig>
  hostMap: Map<string, string>
  docker: Dockerode

  constructor (configPath: string) {
    this.docker = new Dockerode({ socketPath: '/var/run/docker.sock' })
    this.containerConfigs = new Map()
    this.hostMap = new Map()

    void this.inspectConfig(configPath)

    setInterval(() => {
      void this.inspectConfig(configPath)
    }, 60000)
  }

  resolveIP (hostname: string): string | undefined {
    return this.hostMap.get(hostname)
  }

  resolveConfig (name: string): ContainerConfig | undefined {
    return this.containerConfigs.get(name)
  }

  async resolveContainer (name: string): Promise<Container | undefined> {
    const container = await this.docker.getContainer(name)
    return container
  }

  async inspectConfig (configPath: string): Promise<void> {
    log.info('Revalidating hostmap configuration')
    const startTime = Date.now()
    const configContents = fs.readFileSync(configPath, 'utf8')
    const config = YAML.parse(configContents)

    let containers = await this.docker.listContainers({ all: true })

    const hostnames: Map<string, string> = new Map()

    const tempContainerConfigs = new Map()
    const tempHostMap = new Map()

    for (const [name, container] of Object.entries(config.containers as { [name: string]: ContainerConfig })) {
      try {
        log.info(` - Validating "${name}"`)

        const dockerContainerInfo = containers.find(c => c.Names.includes(`/${name}`))

        if (!dockerContainerInfo) {
          log.info('   - Not found"')
          log.info('   - Creating container ')
          const createCmd = `docker run -i -d \
          --name="${name}" \
          --hostname="${name}.leah.one" \
          --expose=80 \
          --expose=443 \
          -e PUID=1000 \
          -e PGID=1000 \
          -e TZ=Europe/London \
          --restart unless-stopped \
          docker.io/library/ubuntu:latest`
          await exec(createCmd)
          log.info('   - Container created ')
        }

        tempContainerConfigs.set(name, {
          hostnames: container.hostnames,
          ssh_keys: container.ssh_keys
        })
        for (const hostname of container.hostnames) {
          hostnames.set(hostname, name)
        }
      } catch (e) {
        log.error(e)
      }
    }

    containers = await this.docker.listContainers({ all: true })

    // resolve the hostnames map to container ips
    log.info(' - Resolving hostmap')
    const hostmap: { [key: string]: string[] } = {}
    for (const [hostname, container] of hostnames.entries()) {
      try {
        const dockerContainerInfo = containers.find(c => c.Names.includes(`/${container}`))
        if (!dockerContainerInfo) {
          continue
        }
        const network = Object.values(dockerContainerInfo.NetworkSettings.Networks)
        if (network.length === 0) {
          continue
        }
        if (!hostmap[network[0].IPAddress]) {
          hostmap[network[0].IPAddress] = []
        }
        hostmap[network[0].IPAddress].push(hostname)
        tempHostMap.set(hostname, network[0].IPAddress)
      } catch (e) {
        log.error(e)
      }
    }

    for (const [ip, hostnames] of Object.entries(hostmap)) {
      log.info(`   - ${ip}`)
      for (const hostname of hostnames) {
        log.info(`     - ${hostname}`)
      }
    }

    this.containerConfigs = tempContainerConfigs
    this.hostMap = tempHostMap

    log.info(` - Hostmap updated in ${Date.now() - startTime}ms`)
  }
}
