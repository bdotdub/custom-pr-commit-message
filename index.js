import { getInput, setFailed } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { default as Mustache } from 'mustache';

async function run() {
    if (!context.payload.comment.body.includes(getInput('trigger-phrase'))) {
        console.log('Comment does not contain trigger phrase');
        return;
    }

    const octokit = getOctokit(getInput('github-token'));

    console.log("Fetching pull request");

    const { data: pullRequest } = await octokit.rest.pulls.get({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        pull_number: context.payload.issue.number,
    });
    console.log(`Received: ${pullRequest.title} (#${pullRequest.number})`);

    const template = `{{{url}}}

{{body}}`;

    const output = Mustache.render(template, pullRequest);
    console.log("Rendered template", output);

    console.log("About to merge")

    await octokit.rest.pulls.merge({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        pull_number: context.payload.issue.number,
        commit_message: output,
        merge_method: 'squash',
    });
}

try {
    run()
} catch (error) {
    setFailed(error.message);
}
