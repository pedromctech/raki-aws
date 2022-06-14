import * as pulumi from '@pulumi/pulumi'
import { EksCluster } from './lib/2-environments/eks-cluster'
import { Network } from './lib/2-environments/network'

export interface InfrastructureOutput { }

export const mainInfrastructure = (config: pulumi.Config): InfrastructureOutput => {
    // Variables
    const environment = `${config.get('organizationName')}-${pulumi.getStack()}`

    // Environment resources
    const networkModule = new Network(config, environment)
    const eksClusterModule = new EksCluster(config, environment, networkModule)

    // Outputs
    return {}
}
