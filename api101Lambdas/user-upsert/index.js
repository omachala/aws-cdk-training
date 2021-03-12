const AWS = require("aws-sdk");
const db = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || "";
const CACHE_TABLE_NAME = process.env.CACHE_TABLE_NAME || "";

exports.handler = async function (event) {
  const headers = {
    "access-control-allow-origin": "*",
  };

  if (!event.body) {
    return {
      statusCode: 400,
      body: "invalid request, you are missing the parameter body",
      headers,
    };
  }

  const item =
    typeof event.body == "object" ? event.body : JSON.parse(event.body);

  if (!item.postId) {
    return {
      statusCode: 400,
      body: "invalid request, you are missing the parameter postId",
      headers,
    };
  }

  item.userId = event.requestContext.authorizer.token;
  item.updatedAt = Math.floor(Date.now() / 1000);

  const attrs = Object.entries(item).filter(
    ([key]) => key !== "userId" && key !== "postId"
  );

  if (!attrs.length) {
    return {
      statusCode: 400,
      body: "nothing to save, add some params to body",
      headers,
    };
  }

  const UpdateExpression =
    "SET " + attrs.map(([key]) => `${key} = :${key}`).join(", ");

  const ExpressionAttributeValues = attrs.reduce((acc, [key, value]) => {
    acc[`:${key}`] = value;
    return acc;
  }, {});

  const params = {
    TableName: TABLE_NAME,
    Key: {
      userId: item.userId,
      postId: item.postId,
    },
    UpdateExpression,
    ExpressionAttributeValues,
  };

  try {
    await db.update(params).promise();

    // delete cache
    await db.delete({ TableName: CACHE_TABLE_NAME, Key: { id: 0 } }).promise();

    return { statusCode: 201, body: JSON.stringify({ done: true }), headers };
  } catch (dbError) {
    return { statusCode: 500, body: JSON.stringify(dbError), headers };
  }
};
