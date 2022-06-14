import * as aws from '@pulumi/aws'
import * as eks from '@pulumi/eks'
import * as k8s from '@pulumi/kubernetes'
import * as pulumi from '@pulumi/pulumi'
import { ArgoCD } from './argocd'
import { CrossplaneUser } from './crossplane-user'
import { Network } from './network'


export class EksCluster {
    public readonly eksCluster!: eks.Cluster
    public readonly k8sProvider!: k8s.Provider

    constructor(config: pulumi.Config, private readonly environment: string, private readonly network: Network) {
        const defaultInstanceRole = this.setDefaultInstanceRole()
        const eksCluster = this.setEksCluster(defaultInstanceRole)
        const nodegroup = this.setDefaultNodeGroup(eksCluster, defaultInstanceRole)
        const provider = this.setK8sProviderFromEksCluster(eksCluster)
        new ArgoCD({config, environment, provider, dependencies: [eksCluster, nodegroup]})
        new CrossplaneUser({environment, provider, dependencies: [eksCluster, nodegroup]})

        this.eksCluster = eksCluster
        this.k8sProvider = provider
    }


    private clusterName = (): string => `${this.environment}-apps`


    private setDefaultInstanceRole = (): aws.iam.Role => {
        // Create Role
        const role = new aws.iam.Role(`${this.clusterName()}-default-nodegroup`, {
            assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
                Service: 'ec2.amazonaws.com'
            })
        })
        // Add policies to role
        Array.from([
            'arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy',
            'arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy',
            'arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly'
        ]).forEach((policyArn, index) =>
            new aws.iam.RolePolicyAttachment(`${this.clusterName()}-default-nodegroup-${index}`, { policyArn, role })
        )
        return role
    }


    private setEksCluster = (instanceRole: aws.iam.Role): eks.Cluster =>
        new eks.Cluster(this.clusterName(), {
            name: this.clusterName(),
            vpcId: this.network.vpc.id,
            publicSubnetIds: this.network.publicSubnets.map(_ => _.id),
            privateSubnetIds: this.network.privateSubnets.map(_ => _.id),
            endpointPrivateAccess: true,
            version: '1.21',
            providerCredentialOpts: {
                profileName: aws.config.profile
            },
            instanceRoles: [instanceRole],
            skipDefaultNodeGroup: true
        })


    private setDefaultNodeGroup = (cluster: eks.Cluster, instanceRole: aws.iam.Role): eks.ManagedNodeGroup =>
        new eks.ManagedNodeGroup(`${this.clusterName()}-default`, {
            cluster,
            capacityType: 'SPOT',
            instanceTypes: [aws.ec2.InstanceType.T3_Medium],
            nodeRoleArn: instanceRole.arn,
            diskSize: 5,
            scalingConfig: {
                desiredSize: 2,
                minSize: 2,
                maxSize: 4
            },
            labels: {
                nodegroup: `${this.clusterName()}-default`
            }
        })
    
    
    private setK8sProviderFromEksCluster = (cluster: eks.Cluster): k8s.Provider =>
        new k8s.Provider(this.clusterName(), { kubeconfig: cluster.kubeconfig })
}
