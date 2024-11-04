import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import * as TOML from "smol-toml";
import versionCompare from "version-compare";

function gitClone(dir, branch, url) {
	const cwd = "vendor/" + dir;
	if (existsSync(cwd)) {
		return;
	}
	if (branch.length === 40) {
		execFileSync("git", ["-c", "advice.detachedHead=false", "clone", "--depth", "1", url, cwd]);
		execFileSync("git", ["fetch", "--depth", "1", "origin", branch], { cwd });
		execFileSync("git", ["reset", "--hard", branch], { cwd });
	} else {
		execFileSync("git", ["-c", "advice.detachedHead=false", "clone", "--depth", "1", "--branch", branch, url, cwd]);
	}
	execFileSync("git", ["submodule", "update", "--init", "--depth", "1", "--recursive"], { cwd });
}

export function patchFile(path, doPatch) {
	const backup = path + ".path_backup";
	if (existsSync(backup)) {
		return;
	}
	const content = doPatch(path);
	renameSync(path, backup);
	writeFileSync(path, content);
}

export function removeRange(file, start, end) {
	patchFile(file, file => {
		const content = readFileSync(file, "utf8");
		const i = content.indexOf(start);
		const j = content.indexOf(end, i);
		return content.slice(0, i) + content.slice(j);
	});
}

const semverRE = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)(\.(0|[1-9]\d*))?(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/*
 * `compare-versions` does not support "v3.0-pre"
 * `version-compare` does not strip leading "v"
 */
function resolveVersion(tag) {
	const matches = semverRE.exec(tag);
	if (!matches) {
		return null;
	}
	const v = matches[0];
	return v.charCodeAt(0) === 118 ? v.slice(1) : v;
}

async function checkUpdateGit(key, branch, repo) {
	const cwd = "vendor/" + key;
	const version = resolveVersion(branch);

	if (version) {
		// Returns in strings order, which is equivalent to unordered.
		const stdout = execFileSync("git", ["ls-remote", "--tags", "origin"], { cwd, encoding: "utf8" });

		let latestTag = branch;
		let latest = version;
		for (const line of stdout.split("\n")) {
			// 40 hash + \t + refs/tags/ = 51 chars
			const tagName = line.slice(51);
			const remote = resolveVersion(tagName);
			if (!remote) {
				continue;
			}
			if (versionCompare(remote, latest) === 1) {
				latest = remote;
				latestTag = tagName;
			}
		}
		if (latest !== version) {
			console.log(`${repo} ${branch} -> ${latestTag}`);
		}
	} else {
		execFileSync("git", ["fetch", "--quiet"], { cwd });
		const stdout = execFileSync("git", ["log", "HEAD..origin", "--pretty=%at"], {
			cwd,
			encoding: "utf8",
		});
		const commits = stdout.split("\n").filter(Boolean);
		if (commits.length === 0) {
			return;
		}
		const date = new Date(parseInt(commits[0]) * 1000).toISOString();
		console.log(`${repo} has new commits, latest date: ${date}`);
	}
}

async function checkUpdateCargo(cwd) {
	// execFileSync does not return stderr, which is cargo will output.
	const execFileAsync = promisify(execFile);
	const { stderr } = await execFileAsync("cargo", ["update", "--dry-run"], {
		cwd,
		encoding: "utf8",
	});

	const cargo = TOML.parse(readFileSync(`${cwd}/cargo.toml`, "utf8"));
	const re = /Updating (\S+) v([0-9.]+) -> v([0-9.]+)/g;

	let primaryUpdatable = false;
	let deepDeps = 0;
	for (const [, name, old, latest] of stderr.matchAll(re)) {
		if (Object.hasOwn(cargo.dependencies, name)) {
			primaryUpdatable = true;
			console.info(`${name} ${old} -> ${latest}`);
		} else {
			deepDeps += 1;
		}
	}
	if (primaryUpdatable) {
		console.info(`Others ${deepDeps} carets update available.`);
	}
}

export class RepositoryManager {

	constructor(repos) {
		this.repos = Object.entries(repos);
	}

	download() {
		for (const [k, v] of this.repos) {
			gitClone(k, v[0], v[1]);
		}
	}

	async checkUpdate() {
		console.log(`Checking ${this.repos.length} repos + cargo...\n`);
		await checkUpdateCargo("rust");
		for (const [key, value] of this.repos) {
			await checkUpdateGit(key, ...value);
		}
	}

	writeVersionsJSON() {
		const json = [];
		for (const [name, [version, repository]] of this.repos) {
			const entry = { name, version, repository };
			json.push(entry);

			if (semverRE.test(version)) {
				continue;
			}
			const stdout = execFileSync("git", ["log", "-1", "--format=%h %at"], {
				cwd: `vendor/${name}`,
				encoding: "utf8",
			});
			const [hash, timestamp] = stdout.split(" ");
			const date = new Date(parseInt(timestamp) * 1000);
			entry.version = `${hash} ${date.toISOString().split("T")[0]}`;
		}
		writeFileSync("versions.json", JSON.stringify(json));
	}
}
