const AWS = require("aws-sdk");
const db = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || "";

exports.handler = async (event) => {
  const headers = {
    "access-control-allow-origin": "*",
  };

  const userId = event.requestContext.authorizer.token;
  if (!userId) {
    return {
      statusCode: 400,
      body: `Error: You are missing the path parameter id`,
      headers,
    };
  }

  const params = {
    TableName : TABLE_NAME,
    IndexName : 'userIdIndex',
    KeyConditionExpression : 'userId = :userId', 
    ExpressionAttributeValues : {
        ':userId' : userId     
    }
}

  try {
    const response = await db.query(params).promise();
    return {
      statusCode: 200,
      body: JSON.stringify(response.Items),
      headers,
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify(e), headers };
  }
};
