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
const networkModule = (config: pulumi.Config): Network =>
    new Network({
        vpcName: `${pulumi.getStack()}-apps`,
        vpcCidrBlock: config.get('vpcCidrBlock'),
        availabilityZones: [
            {
                az: aws.config.requireRegion().toString() + 'a',
                publicSubnetCidr: config.get('publicSubnetCidrZoneA'),
                privateSubnetCidr: config.get('privateSubnetCidrZoneA')
            },
            {
                az: aws.config.requireRegion().toString() + 'b',
                publicSubnetCidr: config.get('publicSubnetCidrZoneB'),
                privateSubnetCidr: config.get('privateSubnetCidrZoneB')
            },
            {
                az: aws.config.requireRegion().toString() + 'c',
                publicSubnetCidr: config.get('publicSubnetCidrZoneC'),
                privateSubnetCidr: config.get('privateSubnetCidrZoneC')
            }
        ]
    })


const eksClusterModule = (config: pulumi.Config, network: Network): EksCluster =>
    new EksCluster({
        eksProfileName: aws.config.profile,
        clusterName: `${pulumi.getStack()}-apps`,
        vpc: network.vpc,
        publicSubnets: network.publicSubnets,
        privateSubnets: network.privateSubnets,
        infraRepositoryName: config.get('infraRepositoryName') ?? '',
        infraRepositoryUrl: config.get('infraRepositoryUrl') ?? '',
        k8sResourcesPath: config.get('k8sResourcesPath') ?? ''
    })


/**********************************************************************************
MAIN
**********************************************************************************/
export const mainInfrastructure = (config: pulumi.Config): InfrastructureOutput => {
    // Resources
    const network = networkModule(config)
    eksClusterModule(config, network)

    // Outputs
    return {}
}
