/* eslint-disable no-case-declarations */
import YAML from 'yaml'
import fs from 'fs'
import inquirer from 'inquirer'

const configPath = './containers.yml'
const configContents = fs.readFileSync(configPath, 'utf8')
const config = YAML.parse(configContents)

async function main (): Promise<void> {
  const { action } = await inquirer
    .prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Choose an action',
        choices: [
          { name: 'Create Container', value: 'create' },
          { name: 'Edit Container', value: 'edit' },
          { name: 'Commit', value: 'commit' }
        ]
      }
    ])

  if (action === 'create') {
    const { name, publicKey } = await inquirer
      .prompt([
        {
          type: 'input',
          name: 'name',
          message: 'What is the name of the container?'
        },
        {
          type: 'input',
          name: 'publicKey',
          message: 'What is the public key of the container?'
        }
      ])

    if (config.containers[name] !== undefined) {
      console.error(`Container ${name} already exists`)
      void main()
      return
    }

    config.containers[name] = {
      hostnames: [`${name}.leah.one`],
      ssh_keys: [publicKey]
    }
  } else if (action === 'edit') {
    const { container } = await inquirer
      .prompt([
        {
          type: 'list',
          name: 'container',
          message: 'Which container do you want to edit?',
          choices: Object.keys(config.containers)
        }
      ])

    if (config.containers[container]) {
      const { toEdit } = await inquirer
        .prompt([
          {
            type: 'list',
            name: 'toEdit',
            message: 'What do you want to edit?',
            choices: [
              { name: 'Add Hostname', value: 'add_hostname' },
              { name: 'Add SSH Key', value: 'add_ssh_key' },
              { name: 'Remove Hostname', value: 'remove_hostname' },
              { name: 'Remove SSH Key', value: 'remove_ssh_key' },
              { name: 'Go Back', value: 'back' }
            ]
          }
        ])

      switch (toEdit) {
        case 'add_hostname':
          const { hostname } = await inquirer
            .prompt([
              {
                type: 'input',
                name: 'hostname',
                message: 'What is the hostname?'
              }
            ])
          config.containers[container].hostnames.push(hostname)
          break
        case 'add_ssh_key':
          const { sshKey } = await inquirer
            .prompt([
              {
                type: 'input',
                name: 'sshKey',
                message: 'What is the SSH key?'
              }
            ])
          config.containers[container].ssh_keys.push(sshKey)
          break
        case 'remove_hostname':
          const { hostnameToRemove } = await inquirer
            .prompt([
              {
                type: 'list',
                name: 'hostnameToRemove',
                message: 'Which hostname do you want to remove?',
                choices: config.containers[container].hostnames
              }
            ])
          config.containers[container].hostnames = config.containers[container].hostnames.filter((hostname: string) => hostname !== hostnameToRemove)
          break
        case 'remove_ssh_key':
          const { sshKeyToRemove } = await inquirer
            .prompt([
              {
                type: 'list',
                name: 'sshKeyToRemove',
                message: 'Which SSH key do you want to remove?',
                choices: config.containers[container].ssh_keys.map((sshKey: string) => sshKey.slice(0, 25) + '... ' + sshKey.split(' ').slice(2).join(' '))
              }
            ])

          config.containers[container].ssh_keys = config.containers[container].ssh_keys.filter((sshKey: string) => sshKey !== sshKeyToRemove)
          break
        case 'back':
          void main()
          return
      }
    } else {
      console.log('Container not found')
    }
  } else if (action === 'commit') {
    fs.writeFileSync(configPath, YAML.stringify(config))
    process.exit()
  }
  void main()
}

void main()
