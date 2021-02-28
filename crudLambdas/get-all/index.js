const AWS = require("aws-sdk");
const db = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || "";

exports.handler = async () => {
  const params = {
    TableName: TABLE_NAME,
  };

  try {
    const response = await db.scan(params).promise();
    return { statusCode: 200, body: JSON.stringify(response.Items) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify(e) };
  }
};
