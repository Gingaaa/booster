import { BoosterApp, BoosterConfig } from '@boostercloud/framework-types'
import * as path from 'path'
import { exec } from 'child-process-promise'
import { wrapExecError } from '../common/errors'
import { checkItIsABoosterProject } from './project-checker'
import { currentEnvironment } from './environment'
import { createSandboxProject, removeSandboxProject } from '../common/sandbox'
import { installProductionDependencies } from './dependencies'

export const DEPLOYMENT_SANDBOX = '.deploy'

export async function createDeploymentSandbox(): Promise<string> {
  const sandboxRelativePath = createSandboxProject(DEPLOYMENT_SANDBOX)
  await installProductionDependencies(sandboxRelativePath)
  return sandboxRelativePath
}

export async function cleanProductionSandbox(): Promise<void> {
  removeSandboxProject(DEPLOYMENT_SANDBOX)
}

export async function compileProjectAndLoadConfig(): Promise<BoosterConfig> {
  await checkItIsABoosterProject()
  const userProjectPath = process.cwd()
  await compileProject(userProjectPath)
  return readProjectConfig(userProjectPath)
}

async function compileProject(projectPath: string): Promise<void> {
  try {
    await exec('npm run clean && npm run compile', { cwd: projectPath })
  } catch (e) {
    throw wrapExecError(e, 'Project contains compilation errors')
  }
}

function readProjectConfig(userProjectPath: string): Promise<BoosterConfig> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const userProject = loadUserProject(userProjectPath)
  return new Promise((resolve): void => {
    const app: BoosterApp = userProject.Booster
    app.configureCurrentEnv((config: BoosterConfig): void => {
      checkEnvironmentWasConfigured(app)
      resolve(config)
    })
  })
}

function loadUserProject(userProjectPath: string): { Booster: BoosterApp } {
  return require(path.join(userProjectPath, 'dist', 'index.js'))
}

function checkEnvironmentWasConfigured(app: BoosterApp): void {
  if (app.configuredEnvironments.size == 0) {
    throw new Error(
      "You haven't configured any environment. Please make sure you have at least one environment configured by calling 'Booster.configure' method (normally done inside the folder 'src/config')"
    )
  }
  const currentEnv = currentEnvironment()
  if (!currentEnv) {
    throw new Error(
      "You haven't provided any environment. Please make sure you are using option '-e' with a valid environment name"
    )
  }
  if (!app.configuredEnvironments.has(currentEnv)) {
    throw new Error(
      `The environment '${currentEnv}' does not match any of the environments you used to configure your Booster project, which are: '${Array.from(
        app.configuredEnvironments
      ).join(', ')}'`
    )
  }
}
