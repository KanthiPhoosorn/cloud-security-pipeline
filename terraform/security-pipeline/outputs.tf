output "state_machine_arn" {
  value = aws_sfn_state_machine.remediation.arn
}

output "dynamodb_table" {
  value = aws_dynamodb_table.remediation_state.name
}

output "slack_callback_url" {
  value = "${aws_apigatewayv2_stage.slack_stage.invoke_url}slack/callback"
}
