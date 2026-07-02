import type { GraphClient } from '../graph-client.js'
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

  constructor(graphClient: GraphClient, warningDays: number = 30) {
    this.graphClient = graphClient
    this.warningDays = warningDays
  }

  async scanApplications(env: MonitoringEnv): Promise<MonitorFindings> {
    try {
      console.log('Fetching data from Microsoft Graph API...')
      const [applications, servicePrincipals, organization] = await Promise.all([
        this.graphClient.getApplicationsWithCredentials(
          this.warningDays,
        ) as Promise<ApplicationsResponse>,
        this.graphClient.getServicePrincipalsWithCredentials(
          this.warningDays,
        ) as Promise<ServicePrincipalsResponse>,
        this.graphClient.getOrganization(),
      ])

      console.log(
        `Retrieved ${applications.value.length} applications with credentials, ${servicePrincipals.value.length} service principals with credentials`,
      )

      const organizationInfo = formatOrganizationInfo(organization)
      const results = createEmptyFindings(organizationInfo)

      console.log(`Organization: ${organizationInfo.displayName}`)

      console.log('Checking self-monitoring configuration...')
      const selfMonitoringFindings = await checkSelfMonitoring({
        env,
        applications,
        graphClient: this.graphClient,
      })
      results.selfMonitoringAlerts = selfMonitoringFindings

      if (selfMonitoringFindings.length > 0) {
        console.log(`Found ${selfMonitoringFindings.length} self-monitoring alert(s)`)
      } else {
        console.log('Self-monitoring check passed')
      }

      console.log(`Analyzing ${applications.value.length} applications...`)
      for (const app of applications.value) {
        const findings = await analyzeApplicationCredentials({
          app,
          warningDays: this.warningDays,
        })
        mergeFindings(results, findings)
      }

      console.log(`Analyzing ${servicePrincipals.value.length} service principals...`)
      for (const sp of servicePrincipals.value) {
        const findings = await analyzeServicePrincipalCredentials({
          sp,
          warningDays: this.warningDays,
        })
        mergeFindings(results, findings)
      }

      console.log('Scan Results Summary:')
      console.log(`   Expired secrets: ${results.expiredSecrets.length}`)
      console.log(`   Expiring secrets: ${results.expiringSecrets.length}`)
      console.log(`   Expired certificates: ${results.expiredCertificates.length}`)
      console.log(`   Expiring certificates: ${results.expiringCertificates.length}`)
      console.log(`   Self-monitoring alerts: ${results.selfMonitoringAlerts.length}`)

      return results
    } catch (error) {
      console.error('Error scanning applications:', error)
      throw error
    }
  }
}
