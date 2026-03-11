output "vpc_id" {
  value = aws_vpc.lab_vpc.id
}

output "security_group_id" {
  value = aws_security_group.vulnerable_sg.id
}

output "s3_bucket_name" {
  value = aws_s3_bucket.vulnerable_bucket.id
}

output "ec2_instance_id" {
  value = aws_instance.vulnerable_ec2.id
}

output "iam_role_name" {
  value = aws_iam_role.vulnerable_role.name
}
