import type { GraphClient } from '../graph-client.js'
import { consoleLogger, type Logger } from '../logger.js'
import type { Application, EnvConfig, ServicePrincipal } from '../schemas.js'
import { analyzeApplicationCredentials, analyzeServicePrincipalCredentials } from './analyzer.js'
import { createEmptyFindings, type MonitorFindings, mergeFindings } from './findings.js'
import { formatOrganizationInfo } from './formatters.js'
import { checkSelfMonitoring } from './self-monitoring.js'

type MonitoringEnv = Pick<EnvConfig, 'SELF_MONITORING_WARNING_DAYS' | 'ENTRA_CLIENT_ID'>

interface ApplicationsResponse {
  value: Application[]
}

interface ServicePrincipalsResponse {
  value: ServicePrincipal[]
}

export class AppRegistrationMonitor {
  private graphClient: GraphClient
  private warningDays: number
  private logger: Logger

  constructor(graphClient: GraphClient, warningDays: number = 30, logger: Logger = consoleLogger) {
    this.graphClient = graphClient
    this.warningDays = warningDays
    this.logger = logger
  }

  async scanApplications(env: MonitoringEnv): Promise<MonitorFindings> {
    try {
      this.logger.info('Fetching data from Microsoft Graph API...')
      const [applications, servicePrincipals, organization] = await Promise.all([
        this.graphClient.getApplicationsWithCredentials(
          this.warningDays,
        ) as Promise<ApplicationsResponse>,
        this.graphClient.getServicePrincipalsWithCredentials(
          this.warningDays,
        ) as Promise<ServicePrincipalsResponse>,
        this.graphClient.getOrganization(),
      ])

      this.logger.info(
        `Retrieved ${applications.value.length} applications with credentials, ${servicePrincipals.value.length} service principals with credentials`,
      )

      const organizationInfo = formatOrganizationInfo(organization)
      const results = createEmptyFindings(organizationInfo)

      this.logger.info(`Organization: ${organizationInfo.displayName}`)

      this.logger.info('Checking self-monitoring configuration...')
      const selfMonitoringFindings = await checkSelfMonitoring({
        env,
        applications,
        graphClient: this.graphClient,
        logger: this.logger,
      })
      results.selfMonitoringAlerts = selfMonitoringFindings

      if (selfMonitoringFindings.length > 0) {
        this.logger.info(`Found ${selfMonitoringFindings.length} self-monitoring alert(s)`)
      } else {
        this.logger.info('Self-monitoring check passed')
      }

      this.logger.info(`Analyzing ${applications.value.length} applications...`)
      for (const app of applications.value) {
        const findings = await analyzeApplicationCredentials({
          app,
          warningDays: this.warningDays,
        })
        mergeFindings(results, findings)
      }

      this.logger.info(`Analyzing ${servicePrincipals.value.length} service principals...`)
      for (const sp of servicePrincipals.value) {
        const findings = await analyzeServicePrincipalCredentials({
          sp,
          warningDays: this.warningDays,
        })
        mergeFindings(results, findings)
      }

      this.logger.info('Scan Results Summary:')
      this.logger.info(`   Expired secrets: ${results.expiredSecrets.length}`)
      this.logger.info(`   Expiring secrets: ${results.expiringSecrets.length}`)
      this.logger.info(`   Expired certificates: ${results.expiredCertificates.length}`)
      this.logger.info(`   Expiring certificates: ${results.expiringCertificates.length}`)
      this.logger.info(`   Self-monitoring alerts: ${results.selfMonitoringAlerts.length}`)

      return results
    } catch (error) {
      this.logger.error({ err: error }, 'Error scanning applications')
      throw error
    }
  }
}
