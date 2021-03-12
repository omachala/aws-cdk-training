const AWS = require("aws-sdk");
const db = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || "";
const CACHE_TABLE_NAME = process.env.CACHE_TABLE_NAME || "";

exports.handler = async () => {
  const headers = {
    "access-control-allow-origin": "*",
  };

  // try load cache
  const cacheData = await db
    .get({ TableName: CACHE_TABLE_NAME, Key: { id: 0 } })
    .promise();

  if (cacheData && cacheData.Item && cacheData.Item.json) {
    return { statusCode: 200, headers, body: cacheData.Item.json };
  }

  const params = { TableName: TABLE_NAME };
  const data = await db.scan(params).promise();

  const response = data.Items.reduce((output, { postId, ...props }) => {
    if (!postId) {
      return output;
    }
    const voteProps = Object.entries(props).filter(([key]) =>
      key.includes("Vote")
    );
    output[postId] =
      output[postId] ||
      voteProps.reduce((acc, [key]) => ((acc[key] = {}), acc), {});

    voteProps.forEach(([key, value]) => {
      if (value) {
        output[postId][key] = output[postId][key] || {};
        const lastUse = output[postId][key][value] || 0;
        output[postId][key][value] = lastUse + 1;
      }
    });
    return output;
  }, {});

  const json = JSON.stringify(response);

  await db
    .put({ TableName: CACHE_TABLE_NAME, Item: { id: 0, json } })
    .promise();

  try {
    return { statusCode: 200, headers, body: json };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify(e) };
  }
};
