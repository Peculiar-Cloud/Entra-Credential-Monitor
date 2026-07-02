import { differenceInDays, format, parseISO } from 'date-fns'
import type { GraphClient } from '../graph-client.js'
import { consoleLogger, type Logger } from '../logger.js'
import type { Application, Credential, EnvConfig, SelfMonitoringAlert } from '../schemas.js'

type SelfMonitoringEnv = Pick<EnvConfig, 'SELF_MONITORING_WARNING_DAYS' | 'ENTRA_CLIENT_ID'>

interface ApplicationsResponse {
  value?: Application[]
}

interface CheckSelfMonitoringParams {
  env: SelfMonitoringEnv
  applications: ApplicationsResponse | null
  graphClient: GraphClient
  logger?: Logger
}

export async function checkSelfMonitoring({
  env,
  applications,
  graphClient,
  logger = consoleLogger,
}: CheckSelfMonitoringParams): Promise<SelfMonitoringAlert[]> {
  const alerts: SelfMonitoringAlert[] = []
  const warningDays = env.SELF_MONITORING_WARNING_DAYS
  const clientId = env.ENTRA_CLIENT_ID

  if (!clientId) {
    return alerts
  }

  try {
    let app: Application | null = null

    if (applications?.value) {
      app = applications.value.find((candidate) => candidate.appId === clientId) ?? null
      if (app) {
        logger.info('Using existing application data for self-monitoring check')
      }
    }

    if (!app) {
      logger.info('Making additional API call for self-monitoring check')
      const selfApp = await graphClient.makeRequest<ApplicationsResponse>(
        `/applications?$filter=appId eq '${clientId}'&$select=id,appId,displayName,passwordCredentials,keyCredentials`,
      )
      app = selfApp.value?.[0] ?? null
    }

    if (!app) {
      alerts.push({
        type: 'CRITICAL',
        message: 'Self-monitoring failed: Cannot find monitoring application in Entra ID',
        action: 'Verify ENTRA_CLIENT_ID is correct and application exists',
      })
      return alerts
    }

    const now = new Date()

    if (app.passwordCredentials && app.passwordCredentials.length > 0) {
      for (const secret of app.passwordCredentials) {
        const expiryDate = parseISO(secret.endDateTime)
        const daysUntilExpiry = differenceInDays(expiryDate, now)

        if (daysUntilExpiry < 0) {
          alerts.push({
            type: 'CRITICAL',
            message: `CRITICAL: Monitoring app secret expired ${Math.abs(daysUntilExpiry)} days ago`,
            appName: app.displayName,
            appId: app.appId,
            secretId: secret.keyId,
            expiredDate: format(expiryDate, 'yyyy-MM-dd'),
            daysExpired: Math.abs(daysUntilExpiry),
            action: 'Generate new client secret immediately to prevent monitoring failure',
          })
        } else if (daysUntilExpiry <= warningDays) {
          alerts.push({
            type: 'WARNING',
            message: `Monitoring app secret expires in ${daysUntilExpiry} days`,
            appName: app.displayName,
            appId: app.appId,
            secretId: secret.keyId,
            expiryDate: format(expiryDate, 'yyyy-MM-dd'),
            daysUntilExpiry,
            action: 'Schedule client secret renewal to prevent monitoring disruption',
          })
        }
      }
    }

    if (app.keyCredentials && app.keyCredentials.length > 0) {
      for (const cert of app.keyCredentials) {
        const expiryDate = parseISO(cert.endDateTime)
        const daysUntilExpiry = differenceInDays(expiryDate, now)

        if (daysUntilExpiry < 0) {
          alerts.push({
            type: 'CRITICAL',
            message: `CRITICAL: Monitoring app certificate expired ${Math.abs(daysUntilExpiry)} days ago`,
            appName: app.displayName,
            appId: app.appId,
            thumbprint: (cert as Credential & { customKeyIdentifier?: string }).customKeyIdentifier,
            expiredDate: format(expiryDate, 'yyyy-MM-dd'),
            daysExpired: Math.abs(daysUntilExpiry),
            action: 'Renew certificate immediately to prevent monitoring failure',
          })
        } else if (daysUntilExpiry <= warningDays) {
          alerts.push({
            type: 'WARNING',
            message: `Monitoring app certificate expires in ${daysUntilExpiry} days`,
            appName: app.displayName,
            appId: app.appId,
            thumbprint: (cert as Credential & { customKeyIdentifier?: string }).customKeyIdentifier,
            expiryDate: format(expiryDate, 'yyyy-MM-dd'),
            daysUntilExpiry,
            action: 'Schedule certificate renewal to prevent monitoring disruption',
          })
        }
      }
    }

    const hasSecrets = app.passwordCredentials && app.passwordCredentials.length > 0
    const hasCertificates = app.keyCredentials && app.keyCredentials.length > 0

    if (!hasSecrets && !hasCertificates) {
      alerts.push({
        type: 'CRITICAL',
        message: 'CRITICAL: Monitoring app has no authentication credentials',
        appName: app.displayName,
        appId: app.appId,
        action: 'Add client secret or certificate to monitoring application',
      })
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    alerts.push({
      type: 'ERROR',
      message: `Self-monitoring check failed: ${err.message}`,
      action: 'Check monitoring app permissions and configuration',
    })
  }

  return alerts
}
