#!/usr/bin/env python3
# WARNING - to work with python environments we cannot use /bin/python3 or
#           a hardcoded abs path.
import json
import os
import sys
import unittest


# Should only run after api login password test has been run
class TestDataFedPythonAPIRepo(unittest.TestCase):
    def setUp(self):
        path_of_file = os.path.abspath(__file__)
        current_folder = os.path.dirname(path_of_file)
        path_to_python_datafed_module = os.path.normpath(
            current_folder
            + os.sep
            + ".."
            + os.sep
            + ".."
            + os.sep
            + "python/datafed_pkg"
        )
        sys.path.insert(0, path_to_python_datafed_module)
        try:
            from datafed.CommandLib import API
        except ImportError:
            print(
                "datafed was not found, make sure you are running script with "
                "PYTHONPATH set to the location of the package in the datafed repo"
            )
            sys.exit(1)

        from datafed import version as df_ver

        print(df_ver)

        datafed_domain = os.environ.get("DATAFED_DOMAIN")
        opts = {"server_host": datafed_domain}
        self._df_api = API(opts)

        username = "datafed89"
        password = os.environ.get("DATAFED_USER89_PASSWORD")

        count = 0
        while True:
            try:
                self._df_api.loginByPassword(username, password)
                break
            except BaseException:
                pass
            count += 1
            # Try three times to authenticate
            assert count < 3

        path_to_repo_form = os.environ.get("DATAFED_REPO_FORM_PATH")
        if path_to_repo_form is None:
            self.fail("DATAFED_REPO_FORM_PATH env variable is not defined")

        if not path_to_repo_form.endswith(".json"):
            self.fail(
                "repo create test requires that the repo form exist and be "
                "provided as a json file, the test uses the environment "
                "variable DATAFED_REPO_PATH to search for the repo form"
            )

        self._repo_form = {}
        with open(path_to_repo_form) as json_file:
            self._repo_form = json.load(json_file)

        if len(self._repo_form["exp_path"]) == 0:
            print(
                "exp_path is empty, we will set it to / for the test. This is "
                "cruft and should be removed anyway"
            )
            self._repo_form["exp_path"] = "/"

        self._repo_form["admins"] = ["u/" + username]

    def test_repo_list(self):
        result = self._df_api.repoList(list_all=True)
        self.assertEqual(len(result[0].repo), 0)

    def test_repo_create_delete(self):
        result = self._df_api.repoCreate(
            repo_id=self._repo_form["id"],
            title=self._repo_form["title"],
            desc=self._repo_form["desc"],
            domain=self._repo_form["domain"],
            capacity=self._repo_form["capacity"],
            pub_key=self._repo_form["pub_key"],
            address=self._repo_form["address"],
            endpoint=self._repo_form["endpoint"],
            path=self._repo_form["path"],
            exp_path=self._repo_form["exp_path"],
            admins=self._repo_form["admins"],
        )

        self.assertEqual(len(result[0].repo), 1)

        self.assertEqual(result[0].repo[0].pub_key, self._repo_form["pub_key"])
        self.assertEqual(result[0].repo[0].capacity, self._repo_form["capacity"])
        self.assertEqual(result[0].repo[0].address, self._repo_form["address"])

        result = self._df_api.repoList(list_all=True)
        self.assertEqual(len(result[0].repo), 1)

        repo_id = self._repo_form["id"]
        if not repo_id.startswith("repo/"):
            repo_id = "repo/" + repo_id
        print(f"Delete repo {repo_id}")
        result = self._df_api.repoDelete(repo_id)
        result = self._df_api.repoList(list_all=True)
        self.assertEqual(len(result[0].repo), 0)


if __name__ == "__main__":
    suite = unittest.TestSuite()
    # Add them in the order they should be executed
    suite.addTest(TestDataFedPythonAPIRepo("test_repo_list"))
    suite.addTest(TestDataFedPythonAPIRepo("test_repo_create_delete"))
    runner = unittest.TextTestRunner()
    result = runner.run(suite)
    # wasSuccessful() return True which is not 0
    sys.exit(not result.wasSuccessful())
