# raki-aws

## How this Pulumi project was generated?

```bash
# Local backend
pulumi login --local

# Generate project
pulumi new aws-typescript \
    --name raki-aws \
    --description "AWS Infrastructure for RAKI Organization" \
    --generate-only

# Generate production stack
pulumi stack init production \
    --secrets-provider "awskms://production-pulumi-secret-provider?region=us-east-1"

# Generate development stack
pulumi stack init development \
    --secrets-provider "awskms://development-pulumi-secret-provider?region=us-east-1"
```
