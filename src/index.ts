/* eslint-disable @typescript-eslint/no-var-requires */
import 'module-alias/register'

import ContainerManager from '~/container-manager'
import HTTPServer from './http-server'
import SSHServer from './ssh-server'
import HTTPSServer from './https-server'

const manager = new ContainerManager('./containers.yml')
const https = new HTTPSServer('./ssl.yml', manager, 4443)
const http = new HTTPServer(manager, 8080)
const ssh = new SSHServer('./id_rsa', 2222, manager)
