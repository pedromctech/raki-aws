import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'
import { EksCluster } from './lib/2-environments/eks-cluster'
import { Network } from './lib/2-environments/network'

export interface InfrastructureOutput { }

/**********************************************************************************
1. Organization resources
**********************************************************************************/

/**********************************************************************************
2. Environment resources
**********************************************************************************/
const networkModule = (): Network =>
    new Network({
        vpcName: `${pulumi.getStack()}-apps`,
        vpcCidrBlock: '10.2.0.0/20',
        availabilityZones: [
            {
                az: aws.config.requireRegion().toString() + 'a',
                publicSubnetCidr: '10.2.0.0/24',
                privateSubnetCidr: '10.2.3.0/24'
            },
            {
                az: aws.config.requireRegion().toString() + 'b',
                publicSubnetCidr: '10.2.1.0/24',
                privateSubnetCidr: '10.2.4.0/24'
            },
            {
                az: aws.config.requireRegion().toString() + 'c',
                publicSubnetCidr: '10.2.2.0/24',
                privateSubnetCidr: '10.2.5.0/24'
            }
        ]
    })


const eksClusterModule = (network: Network): EksCluster =>
    new EksCluster({
        eksProfileName: aws.config.profile,
        clusterName: `${pulumi.getStack()}-apps`,
        vpc: network.vpc,
        publicSubnets: network.publicSubnets,
        privateSubnets: network.privateSubnets
    })


/**********************************************************************************
MAIN
**********************************************************************************/
export const mainInfrastructure = (config: pulumi.Config): InfrastructureOutput => {
    // Resources
    const network = networkModule()
    eksClusterModule(network)

    // Outputs
    return {}
}
