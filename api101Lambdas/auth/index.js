const SCOPE_ARN = process.env.SCOPE_ARN || "";

exports.handler = async function (event) {
  const token = event.authorizationToken.toLowerCase();
  const scopeArn = SCOPE_ARN;
  if (token && token.length === 10) {
    return generateAuthResponse("user", "Allow", scopeArn, { token });
  }
  return generateAuthResponse("user", "Deny", scopeArn, { token });
};

function generateAuthResponse(principalId, effect, methodArn, context) {
  const policyDocument = generatePolicyDocument(effect, methodArn);
  return {
    principalId,
    policyDocument,
    context,
  };
}

function generatePolicyDocument(effect, scopeArn) {
  if (!effect || !scopeArn) return null;
  const policyDocument = {
    Version: "2012-10-17",
    Statement: [
      {
        Action: "execute-api:Invoke",
        Effect: effect,
        Resource: scopeArn,
      },
    ],
  };
  return policyDocument;
}
