variable "aws_region" {
  type = string
}

variable "project_name" {
  type    = string
  default = "smart-job-tracker"
}

variable "instance_type" {
  type    = string
  default = "t3.small"
}

variable "root_volume_size" {
  type    = number
  default = 30
}

variable "key_name" {
  type = string
}

variable "public_key" {
  type = string
}

variable "ssh_cidrs" {
  type    = list(string)
  default = ["0.0.0.0/0"]
}
