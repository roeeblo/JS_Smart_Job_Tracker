# AWS Deployment Files

## Terraform

Path: `aws/terraform`

1. Copy `terraform.tfvars.example` to `terraform.tfvars`
2. Fill `public_key` with your SSH public key
3. Run:

```bash
cd aws/terraform
terraform init
terraform apply
```

Use the output `public_ip` to connect:

```bash
ssh ubuntu@<public_ip>
```

## App Deployment On EC2

1. Clone the repository on the instance
2. Copy `aws/scripts/secrets.env.example` to `aws/scripts/secrets.env`
3. Fill real secret values
4. Run:

```bash
sudo bash aws/scripts/deploy.sh
```

Nginx forwards public traffic to the Kubernetes ingress controller on NodePort `30080`.
