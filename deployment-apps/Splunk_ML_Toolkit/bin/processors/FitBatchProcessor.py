#!/usr/bin/env python
# Copyright (C) 2015-2017 Splunk Inc. All Rights Reserved.

import pandas as pd
import os

import cexc
import conf
import models.base
from sampler import ReservoirSampler
from util.param_util import is_truthy, convert_params
from util.base_util import is_valid_identifier
from util.base_util import match_field_globs
from util.base_util import MLSPLNotImplementedError
from BaseProcessor import BaseProcessor
from util.algos import initialize_algo_class


logger = cexc.get_logger(__name__)
messages = cexc.get_messages_logger()


class FitBatchProcessor(BaseProcessor):
    """The fit batch processor receives and returns pandas DataFrames."""

    def __init__(self, process_options, searchinfo):
        """Initialize options for processor.

        Args:
            process_options (dict): process options
            searchinfo (dict): information required for search
        """
        # Split apart process & algo options
        self.namespace = process_options.pop('namespace', None)
        self.process_options, self.algo_options = self.split_options(process_options)
        self.searchinfo = searchinfo

        # Convenience / readability
        self.tmp_dir = self.process_options['tmp_dir']

        self.algo = self.initialize_algo(self.algo_options, self.searchinfo)

        self.check_algo_options(self.algo_options, self.algo)
        self.save_temp_model(self.algo_options, self.tmp_dir)
        self.resource_limits = self.load_resource_limits(self.algo_options['algo_name'])

        self._sampler_time = 0.0
        self.sampler_limits = self.load_sampler_limits(self.process_options, self.algo_options['algo_name'])
        self.sampler = self.get_sampler(self.sampler_limits)

    @staticmethod
    def split_options(options):
        """Pop tmp_dir from the options. Also, parse sample count
        and sample seed from original params and add them to process options.

        Args:
            options (dict): process options

        Returns:
            process_options (dict): the process options we use here
            algo_options (dict): the algo options to be passed to the algo
        """
        sample_params = {}
        if 'params' in options:
            try:
                sample_params = convert_params(options['params'],
                                               ignore_extra=True,
                                               ints=['sample_count',
                                                     'sample_seed']
                                               )
            except ValueError as e:
                raise RuntimeError(str(e))

        if 'sample_count' in sample_params:
            del options['params']['sample_count']

        if 'sample_seed' in sample_params:
            del options['params']['sample_seed']

        # copy everything from leftover options to algo options
        algo_options = options.copy()

        # brand new process options
        process_options = {}

        # sample options are added to the process options
        process_options['sample_seed'] = sample_params.get('sample_seed', None)
        process_options['sample_count'] = sample_params.get('sample_count', None)

        # needed by processor, not algorithm
        process_options['tmp_dir'] = algo_options.pop('tmp_dir')

        return process_options, algo_options

    @staticmethod
    def initialize_algo(algo_options, searchinfo):
        algo_name = algo_options['algo_name']
        try:
            algo_class = initialize_algo_class(algo_name, searchinfo)
            return algo_class(algo_options)
        except Exception as e:
            cexc.log_traceback()
            raise RuntimeError('Error while initializing algorithm "%s": %s' % (
                algo_name, str(e)))


    @staticmethod
    def check_algo_options(algo_options, algo):
        """Raise errors if options are incompatible

        Args:
            algo_options (dict): algo options
            algo (dict): initialized algo object

        Raises:
            RuntimeError
        """
        # Pre-validate whether or not this algo supports saved models.
        if 'model_name' in algo_options:
            try:
                algo.register_codecs()
            except MLSPLNotImplementedError:
                raise RuntimeError('Algorithm "%s" does not support saved models' % algo_options['algo_name'])
            except Exception as e:
                logger.debug("Error while calling algorithm's register_codecs method. {}".format(str(e)))
                raise RuntimeError('Error while initializing algorithm. See search.log for details.')

    @staticmethod
    def match_and_assign_variables(columns, algo, algo_options):
        """Match field globs and attach variables to algo.

        Args:
            columns (list): columns from dataframe
            algo (object): initialized algo object
            algo_options (dict): algo options

        """
        if hasattr(algo, 'feature_variables'):
            algo.feature_variables = match_field_globs(columns, algo.feature_variables)
        else:
            algo.feature_variables = []

        # Batch fit
        if 'target_variable' in algo_options:
            target_variable = algo_options['target_variable'][0]

            if target_variable in algo.feature_variables:
                algo.feature_variables.remove(target_variable)

        # Partial fit
        elif hasattr(algo, 'target_variable'):
            if algo.target_variable in algo.feature_variables:
                algo.feature_variables.remove(algo.target_variable)

        return algo

    @staticmethod
    def load_sampler_limits(process_options, algo_name):
        """Read sampling limits from conf file and decide sample count.

        Args:
            process_options (dict): process options
            algo_name (str): algo name

        Returns:
            sampler_limits (dict): sampler limits
        """
        sampler_limits = {}

        # setting up the logic to choose the sample count
        sampler_limits['use_sampling'] = is_truthy(str(conf.get_mlspl_prop('use_sampling', algo_name, 'yes')))
        max_inputs = int(conf.get_mlspl_prop('max_inputs', algo_name, -1))
        if process_options['sample_count']:
            sampler_limits['sample_count'] = min(process_options['sample_count'], max_inputs)
        else:
            sampler_limits['sample_count'] = max_inputs

        # simply set sample seed
        sampler_limits['sample_seed'] = process_options['sample_seed']
        return sampler_limits

    @staticmethod
    def get_sampler(sampler_limits):
        """Initialize the sampler and use resource limits from processor.

        Args:
            sampler_limits (dict): sampler limits

        Returns:
            (object): sampler object
        """
        return ReservoirSampler(sampler_limits['sample_count'], random_state=sampler_limits['sample_seed'])

    @staticmethod
    def check_sampler(sampler_limits, algo_name):
        """Inform user if sampling is on or raise error if sampling is off and
        events exceed limit.

        Args:
            sampler_limits (dict): sampler limits
            algo_name (str): algo name
        """
        if is_truthy(sampler_limits['use_sampling']):
            messages.warn(
                'Input event count exceeds max_inputs for %s (%d), model will be fit on a sample of events.' % (
                    algo_name, sampler_limits['sample_count']))
        else:
            raise RuntimeError('Input event count exceeds max_inputs for %s (%d) and sampling is disabled.' % (
                algo_name, sampler_limits['sample_count']))

    @staticmethod
    def load_resource_limits(algo_name):
        """Load algorithm specific resource limits.

        Args:
            algo_name (str): algo_name

        Returns:
            resource_limits (dict): dictionary of resource limits including
                max_fit_time, max_memory_usage_mb, and max_model_size_mb
        """
        resource_limits = {}
        resource_limits['max_memory_usage_mb'] = int(conf.get_mlspl_prop('max_memory_usage_mb', algo_name, -1))
        resource_limits['max_fit_time'] = int(conf.get_mlspl_prop('max_fit_time', algo_name, -1))
        resource_limits['max_model_size_mb'] = int(conf.get_mlspl_prop('max_model_size_mb', algo_name, -1))
        return resource_limits

    @staticmethod
    def save_temp_model(algo_options, tmp_dir):
        """Save temp model for follow-up apply.

        Args:
            algo_options (dict): algo options
            tmp_dir (str): temp directory to save model to
        """
        if 'model_name' in algo_options:
            try:
                models.base.save_model(algo_options['model_name'], None,
                                  algo_options['algo_name'], algo_options,
                                  model_dir=tmp_dir, tmp=True)
            except Exception as e:
                cexc.log_traceback()
                raise RuntimeError(
                    'Error while saving temporary model "%s": %s' % (algo_options['model_name'], e))

    def get_relevant_fields(self):
        """Ask algo for relevant variables and return as relevant fields.

        Returns:
            relevant_fields (list): relevant fields
        """
        relevant_fields = []
        if 'feature_variables' in self.algo_options:
            self.algo.feature_variables = self.algo_options['feature_variables']
            relevant_fields.extend(self.algo_options['feature_variables'])

        if 'target_variable' in self.algo_options:
            self.algo.target_variable = self.algo_options['target_variable'][0]
            relevant_fields.extend(self.algo_options['target_variable'])

        return relevant_fields

    def save_model(self):
        """Attempt to save the model, delete the temporary model."""
        if 'model_name' in self.algo_options:
            try:
                models.base.save_model(self.algo_options['model_name'], self.algo,
                                  self.algo_options['algo_name'], self.algo_options,
                                  max_size=self.resource_limits['max_model_size_mb'],
                                  searchinfo=self.searchinfo, namespace=self.namespace)
            except Exception as e:
                cexc.log_traceback()
                raise RuntimeError('Error while saving model "%s": %s' % (self.algo_options['model_name'], e))
            try:
                models.base.delete_model(self.algo_options['model_name'],
                                    model_dir=self.tmp_dir, tmp=True)
            except Exception as e:
                cexc.log_traceback()
                logger.warn('Exception while deleting tmp model "%s": %s', self.algo_options['model_name'], e)

    def receive_input(self, df):
        """Receive dataframe and append to sampler if necessary.

        Args:
            df (dataframe): dataframe received from controller
        """
        if self.sampler_limits['sample_count'] - len(df) < self.sampler.count <= self.sampler_limits['sample_count']:
            self.check_sampler(sampler_limits=self.sampler_limits, algo_name=self.algo_options['algo_name'])

        with cexc.Timer() as sampler_t:
            self.sampler.append(df)
        self._sampler_time += sampler_t.interval

        logger.debug('sampler_time=%f', sampler_t.interval)

    def process(self):
        """Get dataframe, update algo, and possibly make predictions."""
        self.df = self.sampler.get_df()
        self.algo = self.match_and_assign_variables(self.df.columns, self.algo, self.algo_options)
        self.algo, self.df, self.has_applied = self.fit(self.df, self.algo, self.algo_options)

    @staticmethod
    def fit(df, algo, algo_options):
        """Perform the literal fitting process.

        This method updates the algo by fitting with input data. Some of the
        algorithms additionally make predictions within their fit method, thus
        the predictions are returned in dataframe type. Some other algorithms do
        not make prediction in their fit method, thus None is returned.

        Args:
            df (dataframe): dataframe to fit the algo
            algo (object): initialized/loaded algo object
            algo_options (dict): algo options

        Returns:
            algo (object): updated algo object
            df (dataframe):
                - if algo.fit makes prediction, return prediction
                - if algo.fit does not make prediction, return input df
            has_applied (bool): flag to indicate whether df represents
                original df or prediction df
        """
        try:
            prediction_df = algo.fit(df, options=algo_options)
        except Exception as e:
            cexc.log_traceback()
            raise RuntimeError('Error while fitting "%s" model: %s' % (algo_options['algo_name'], str(e)))

        has_applied = isinstance(prediction_df, pd.DataFrame)

        if has_applied:
            df = prediction_df

        return algo, df, has_applied

    def get_output(self):
        """Override get_output from BaseProcessor.

        Check if prediction was already made, otherwise make prediction.

        Returns:
            (dataframe): output dataframe
        """
        if not self.has_applied:
            try:
                self.df = self.algo.apply(self.df, options=self.algo_options)
            except Exception as e:
                cexc.log_traceback()
                logger.debug('Error during apply phase of fit command. Check apply method of algorithm.')
                raise RuntimeError('Error while fitting "%s" model: %s' % (self.algo_options['algo_name'], str(e)))

        if self.df is None:
            messages.warn('Apply method did not return any results.')
            self.df = pd.DataFrame()

        return self.df
