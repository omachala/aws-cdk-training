const AWS = require("aws-sdk");
const db = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || "";

exports.handler = async () => {
  const headers = {
    "access-control-allow-origin": "*",
  };

  const params = {
    TableName: TABLE_NAME,
    AttributesToGet: ["postId", "useVote", "opinionVote"],
  };

  const data = await db.scan(params).promise();

  const response = data.Items.reduce(
    (acc, { postId, useVote, opinionVote }) => {
      acc[postId] = acc[postId] || { useVote: {}, opinionVote: {} };
      if (useVote) {
        const lastUseVoteVal = acc[postId]["useVote"][useVote] || 0;
        acc[postId]["useVote"][useVote] = lastUseVoteVal + 1;
      }
      if (opinionVote) {
        const lastOpinionVoteVal = acc[postId]["opinionVote"][opinionVote] || 0;
        acc[postId]["opinionVote"][opinionVote] = lastOpinionVoteVal + 1;
      }
      return acc;
    },
    {}
  );

  try {
    return { statusCode: 200, headers, body: JSON.stringify(response) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify(e) };
  }
};
