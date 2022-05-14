import * as aws from '@pulumi/aws'
import * as eks from '@pulumi/eks'

export const DEFAULT_EKS_INSTANCE_POLICIES = [
    'arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy',
    'arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy',
    'arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly'
]

export interface EksClusterProps {
    eksProfileName?: string
    clusterName: string
    vpc: aws.ec2.Vpc | aws.ec2.DefaultVpc
    publicSubnets: aws.ec2.Subnet[]
    privateSubnets: aws.ec2.Subnet[]
}

export class EksCluster {
    constructor (private readonly props: EksClusterProps) {
        const defaultInstanceRole = this.setDefaultInstanceRole()
        this.setDefaultInstanceRolePolicies(defaultInstanceRole)
        const eksCluster = this.setEksCluster(defaultInstanceRole)
        this.setDefaultNodeGroup(eksCluster, defaultInstanceRole)
    }


    private setDefaultInstanceRole = (): aws.iam.Role =>
        new aws.iam.Role(`${this.props.clusterName}-default-nodegroup`, {
            assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
                Service: 'ec2.amazonaws.com'
            })
        })
    

    private setDefaultInstanceRolePolicies = (role: aws.iam.Role): aws.iam.RolePolicyAttachment[] =>
        DEFAULT_EKS_INSTANCE_POLICIES
            .map((policyArn, index) => new aws.iam.RolePolicyAttachment(`${this.props.clusterName}-default-nodegroup-${index}`, { policyArn, role }))


    private setEksCluster = (instanceRole: aws.iam.Role): eks.Cluster =>
        new eks.Cluster(this.props.clusterName, {
            name: this.props.clusterName,
            vpcId: this.props.vpc.id,
            publicSubnetIds: this.props.publicSubnets.map(_ => _.id),
            privateSubnetIds: this.props.privateSubnets.map(_ => _.id),
            version: '1.22',
            providerCredentialOpts: {
                profileName: this.props.eksProfileName
            },
            instanceRoles: [ instanceRole ],
            skipDefaultNodeGroup: true
        })
    
    
    private setDefaultNodeGroup = (cluster: eks.Cluster, instanceRole: aws.iam.Role): eks.ManagedNodeGroup =>
        new eks.ManagedNodeGroup(`${this.props.clusterName}-default`, {
            cluster,
            capacityType: 'SPOT',
            instanceTypes: [aws.ec2.InstanceType.T2_Medium],
            nodeRoleArn: instanceRole.arn,
            diskSize: 5,
            scalingConfig: {
                desiredSize: 1,
                minSize: 1,
                maxSize: 2
            },
            labels: {
                nodegroup: `${this.props.clusterName}-default`
            }
        })
}
