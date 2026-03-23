output "instance_id" {
  value = aws_instance.sjt.id
}

output "public_ip" {
  value = aws_instance.sjt.public_ip
}

output "public_dns" {
  value = aws_instance.sjt.public_dns
}
