import { getInput, setFailed } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { default as Mustache } from 'mustache';

async function run() {
    const githubToken = getInput('repo-token ', { required: true });
    const octokit = getOctokit(githubToken);

    console.log("Fetching pull request");

    const { data: pullRequest } = await octokit.pulls.get({
        owner: context.repository.owner.login,
        repo: context.repository.name,
        pull_number: context.issue.number,
    });
    console.log(`Received: ${pullRequest.title} (#${pullRequest.number})`);

    const template = `{{{url}}}

{{body}}`;

    const output = Mustache.render(template, pullRequest);
    console.log("Rendered template", output);

    console.log("About to merge")

    await octokit.pulls.merge({
        owner: context.repository.owner.login,
        repo: context.repository.name,
        pull_number: context.issue.number,
        commit_message: output,
        merge_method: 'squash',
    });
}

try {
    run()
} catch (error) {
    setFailed(error.message);
}