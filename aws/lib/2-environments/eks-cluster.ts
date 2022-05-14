import * as aws from '@pulumi/aws'
import * as eks from '@pulumi/eks'
import * as k8s from '@pulumi/kubernetes'


export interface EksClusterProps {
    eksProfileName?: string
    clusterName: string
    vpc: aws.ec2.Vpc | aws.ec2.DefaultVpc
    publicSubnets: aws.ec2.Subnet[]
    privateSubnets: aws.ec2.Subnet[]
}


export class EksCluster {
    public readonly eksCluster!: eks.Cluster
    public readonly k8sProvider!: k8s.Provider

    constructor(private readonly props: EksClusterProps) {
        const defaultInstanceRole = this.setDefaultInstanceRole()
        this.eksCluster = this.setEksCluster(defaultInstanceRole)
        this.setDefaultNodeGroup(defaultInstanceRole)
    }


    private setDefaultInstanceRole = (): aws.iam.Role => {
        // Create Role
        const role = new aws.iam.Role(`${this.props.clusterName}-default-nodegroup`, {
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
            new aws.iam.RolePolicyAttachment(`${this.props.clusterName}-default-nodegroup-${index}`, { policyArn, role })
        )
        return role
    }


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
            instanceRoles: [instanceRole],
            skipDefaultNodeGroup: true
        })


    private setDefaultNodeGroup = (instanceRole: aws.iam.Role): eks.ManagedNodeGroup =>
        new eks.ManagedNodeGroup(`${this.props.clusterName}-default`, {
            cluster: this.eksCluster,
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
