const AWS = require("aws-sdk");
const db = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || "";
const PRIMARY_KEY = process.env.PRIMARY_KEY || "";

exports.handler = async function (event) {
  if (!event.body) {
    return {
      statusCode: 400,
      body: "invalid request, you are missing the parameter body",
    };
  }
  const body =
    typeof event.body == "object" ? event.body : JSON.parse(event.body);

  const item = { body };
  item[PRIMARY_KEY] = Math.random().toString(26).slice(2);
  item.createdBy = event.requestContext.authorizer.token
  item.createdAt = Math.floor(Date.now() / 1000)

  const params = {
    TableName: TABLE_NAME,
    Item: item,
  };

  try {
    await db.put(params).promise();
    return { statusCode: 201, body: JSON.stringify(item) };
  } catch (dbError) {
    return { statusCode: 500, body: JSON.stringify(dbError) };
  }
};
