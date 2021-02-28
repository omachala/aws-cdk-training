const AWS = require("aws-sdk");
const db = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || "";
const PRIMARY_KEY = process.env.PRIMARY_KEY || "";

exports.handler = async (event) => {
  console.log(event);

  if (!event.body) {
    return {
      statusCode: 400,
      body: "invalid request, you are missing the parameter body",
    };
  }

  const editedItemId = event.pathParameters.id;
  if (!editedItemId) {
    return {
      statusCode: 400,
      body: "invalid request, you are missing the path parameter id",
    };
  }

  const editedItem =
    typeof event.body == "object" ? event.body : JSON.parse(event.body);
  const editedItemProperties = Object.keys(editedItem);

  if (!editedItem || editedItemProperties.length < 1) {
    return { statusCode: 400, body: "invalid request, no arguments provided" };
  }

  const params = {
    TableName: TABLE_NAME,
    Key: {
      [PRIMARY_KEY]: editedItemId,
    },
    UpdateExpression: "set body = :d, updatedAt = :ua",
    ExpressionAttributeValues: {
      ":d": editedItem,
      ":ua": Math.floor(Date.now() / 1000),
    },
    ReturnValues: "UPDATED_NEW",
  };

  try {
    await db.update(params).promise();
    return { statusCode: 202, body: "" };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify(e) };
  }
};
