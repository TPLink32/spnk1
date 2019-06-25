#!/usr/bin/env python
import pandas as pd
import numpy as np

import cexc
import conf


def drop_unused_and_missing(X, required_fields):
    """Drop columns that are not *required*, drop rows that have missing values.

    Args:
        X (dataframe): input dataframe
        required_fields (list): required fields

    Returns:
        X (dataframe): output dataframe, with some columns and rows dropped
        nans (np array): boolean array to indicate which rows have missing
            values in the original dataframe
    """
    drop_unused_fields(X, required_fields)
    warn_on_missing_fields(X, required_fields)
    drop_na_columns(X)
    X, nans = drop_na_rows(X)
    return X, nans


def prepare_features(X, variables, final_columns=None, get_dummies=True):
    """Prepare features.

    This method defines conventional steps to prepare features:
        - drop unused columns
        - drop rows that have missing values
        - optionally (if get_dummies==True)
            - convert categorical fields into indicator dummy variables
        - optionally (if final_column is provided)
            - make the resulting dataframe match final_columns

    Args:
        X (dataframe): input dataframe
        variables (list): column names
        final_columns (list): finalized column names
        get_dummies (bool): indicate if categorical variable should be converted

    Returns:
        X (dataframe): prepared feature dataframe
        nans (np array): boolean array to indicate which rows have missing
            values in the original dataframe
        columns (list): sorted list of feature column names
    """
    X, nans = drop_unused_and_missing(X, variables)
    if get_dummies:
        filter_non_numeric(X)
        X = pd.get_dummies(X, prefix_sep='=', sparse=True)
    if final_columns is not None:
        drop_unused_fields(X, final_columns)
        assert_any_fields(X)
        fill_missing_fields(X, final_columns)
    assert_any_rows(X)
    assert_any_fields(X)
    columns = sort_fields(X)
    return (X, nans, columns)


def prepare_features_and_target(X, variables, target):
    """Prepare features and target.

    This method defines conventional steps to prepare features and target:
        - drop unused columns
        - drop rows that have missing values
        - split dataframe into features and target
        - convert categorical variables into indicator dummy variables

    Args:
        X (dataframe): input dataframe
        variables (list): column names
        target (str): column name

    Returns:
        X (dataframe): prepared feature dataframe
        y (pd series): prepared target pandas series
        columns (list): sorted list of feature column names
    """
    X, nans = drop_unused_and_missing(X, variables)
    X, y = split_features_and_target(X, target)
    filter_non_numeric(X)
    X = pd.get_dummies(X, prefix_sep='=', sparse=True)
    assert_any_fields(X)
    assert_any_rows(X)
    columns = sort_fields(X)
    return (X, y, columns)


def create_output_dataframe(y_hat, nans, output_names, shape=None):
    """Create output dataframe.

    This method defines steps to create output dataframe:
        - initialize an empty dataframe according to
            - given list of column names
            - given or inferred shape
        - populate the dataframe with y_hat and fill in nan for no predictions

    Args:
        y_hat (dataframe or pd series): predictions
        nans (np array): boolean array to indicate which rows have missing
            values in the original dataframe
        output_names (str or list): columns names for output dataframe
        shape (tuple): shape for the output dataframe

    Returns:
        output (dataframe): output dataframe
    """
    if shape is None:
        # If we pass multiple output_names in a list,
        # the width is necessarily > 1
        if type(output_names) is list:
            shape = (len(nans), len(output_names))
        else:
            shape = len(nans)

    output = pd.DataFrame(columns=[output_names], data=np.zeros(shape))
    output[output_names] = np.nan
    output.ix[~nans, output_names] = y_hat
    return output


def merge_predictions(original_df, additional_df):
    """Merge two dataframes.

    Args:
        original_df (dataframe): first dataframe
        additional_df (dataframe): second dataframe

    Returns:
        merged_df (dataframe): merged dataframe
    """
    original_df.drop(additional_df.columns, axis=1, errors='ignore', inplace=True)
    merged_df = pd.concat([original_df, additional_df], axis=1,
                          join_axes=[original_df.index])
    return merged_df


def get_unseen_value_behavior(options):
    """Load options for handling new values in categorical fields.

    Args:
        options (dict): options

    Returns:
        handle_new_cat (str): the choice to handle new values
    """
    handle_new_cat = conf.get_mlspl_prop('handle_new_cat',
                                         stanza='default',
                                         default='default')

    if 'params' in options:
        if options['params'].get('unseen_value', []):
            handle_new_cat = options['params']['unseen_value']
            del options['params']['unseen_value']

    return handle_new_cat


def handle_new_categorical_values(X, y, options, columns, classes=None):
    """Handle new/unseen categorical values.

    Categorical variables are usually converted to indicator dummy variables.
    Models with incremental fit capability will save the total number of
    features produced. This method defines what to do when a new indicator
    variable is created from a previously unseen categorical value.

    Args:
        X (dataframe): feature dataframe
        y (pd series): target series
        options (dict): options
        columns (list): column names
        classes (np array): unique class labels in the target

    Returns:
        X (dataframe): feature dataframe
        y (pd series): target series
    """
    handle_new_cat = get_unseen_value_behavior(options)
    action_unseen = {'stop', 'default', 'skip'}
    try:
        assert (handle_new_cat in action_unseen)
    except AssertionError:
        raise Exception('Invalid value for "unseen_value": %s' % handle_new_cat)

    # Fill in empty columns if input has fewer categorical values than the ones
    # the existing model was trained with
    fill_missing_fields(X, columns)
    if handle_new_cat == 'skip':
        # remove rows containing new categorical values in X
        new_cat_ind_X, new_cat_cols = get_indicies_of_unseen_categorical_values(X, columns)
        if len(new_cat_ind_X) > 0:
            X, y = skip_unseen_categorical_values(X, y, new_cat_ind_X, new_cat_cols)
        # remove rows containing new categorical values in y
        if classes is not None:
            X, y = skip_unseen_target_values(X, y, classes)

    elif handle_new_cat == 'default':
        # set columns that corresponds to new categorical value(s) to 0 for applicable rows
        new_cat_ind_X, new_cat_cols = get_indicies_of_unseen_categorical_values(X, columns)
        if len(new_cat_ind_X) > 0:
            X.drop(new_cat_cols, axis=1, inplace=True)
            cexc.messages.warn(
                'Columns correspond to unseen categorical explanatory variable value(s): %s are omitted' % new_cat_cols)
        # remove rows containing new categorical values in y
        if classes is not None:
            X, y = skip_unseen_target_values(X, y, classes)

    else:
        # stops when encountering rows containing new categorical values (X or y)
        new_col_in_X = np.setdiff1d(X.columns, columns)
        if len(new_col_in_X) > 0:
            raise RuntimeError(
                'New categorical value for explanatory variables in training data: %s' % new_col_in_X)
        if classes is not None:
            new_class_in_y = np.setdiff1d(y, classes)
            if len(new_class_in_y) > 0:
                raise RuntimeError('New target values in training data: %s' % new_class_in_y)

    return X, y


def filter_non_numeric(df, max_values=100):
    """Filter out non-numeric columns with too many unique factors.

    Args:
        df (dataframe): input dataframe
        max_values (int): limit of distinct values

    Returns:
        df (dataframe): output dataframe
    """
    drop_cols = []
    scols = list(df.dtypes[df.dtypes == 'object'].index)

    # TODO: Profile this loop.
    for scol in scols:
        if df[scol].nunique() > max_values:
            drop_cols.append(scol)

    if len(drop_cols) > 0:
        cexc.messages.warn('Dropping field(s) with too many distinct values: %s',
                           ', '.join(drop_cols))
        df.drop(drop_cols, inplace=True, axis=1)

    if len(df.columns) == 0:
        raise RuntimeError('No valid fields to fit or apply model to.')

    return df


def assert_field_present(df, field):
    """Make sure field is present.

    Args:
        df (dataframe): input dataframe
        field (str): column name

    Raises:
        Exception
    """
    if field not in df:
        raise Exception('Field "%s" not present.' % field)


def limit_classes_for_classifier(df, field, max_values=100):
    """Limit the number of categories for classifiers.

    Args:
        df (dataframe): input dataframe
        field (str): column name
        max_values (int): limit of distinct values

    Returns:
        df (dataframe): output dataframe
    """
    assert_field_present(df, field)
    n = df[field].nunique()
    if n > max_values:
        raise Exception('Field "%s" has too many distinct values: %d (max %d)' % (
            field, n, max_values))
    nans = df[field].isnull()
    df[field] = df[field].astype(str)
    df.ix[nans, field] = np.nan
    return df


def drop_unused_fields(df, requested_fields):
    """Drop fields the user didn't ask for.

    Args:
        df (dataframe): input dataframe
        requested_fields (list): column names

    Returns:
        df (dataframe): output dataframe
    """
    drop_cols = set(df.columns).difference(requested_fields)
    df.drop(drop_cols, inplace=True, axis=1)
    return df


def warn_on_missing_fields(df, requested_fields):
    """Raise user-visible warning for missing fields.

    Args:
        df (dataframe): input dataframe
        requested_fields (list): column names
    """
    missing_columns = set(requested_fields).difference(df.columns)
    if len(missing_columns) > 0:
        cexc.messages.warn('Missing field(s): %s', ', '.join(missing_columns))


def split_features_and_target(df, target_variable):
    """Split features and target in input dataframe and return.

    Args:
        df (dataframe): input dataframe
        target_variable (str): column name

    Returns:
        features (dataframe): feature dataframe
        target (pandas series): target series
    """
    assert_field_present(df, target_variable)
    target = df.pop(target_variable)
    features = df
    assert_any_fields(features)
    return features, target


def drop_na_columns(df):
    """Drop columns where all values are missing/null.

    Args:
        df (dataframe): input dataframe

    Returns:
        df (dataframe): output dataframe, with na columns dropped
    """
    start_columns = df.columns
    df.dropna(axis=1, how='all', inplace=True)
    end_columns = df.columns
    drop_cols = set(start_columns).difference(end_columns)
    if len(drop_cols) > 0:
        cexc.messages.warn('Dropped field(s) with all null values: %s',
                           ', '.join(drop_cols))
    return df


def drop_na_rows(df):
    """Drop rows that have missing values.

    Args:
        df (dataframe): input dataframe

    Returns:
        df (dataframe): output dataframe, with na rows dropped
        nans (np array): boolean array to indicate which rows have missing
            values in the original dataframe
    """
    nans = df.isnull().any(axis=1).values
    df.dropna(axis=0, how='any', inplace=True)
    return df, nans


def assert_any_fields(df):
    """Make sure there are valid field(s).

    Args:
        df (dataframe): input dataframe

    Raises:
        RuntimeError
    """
    if len(df.columns) == 0:
        raise RuntimeError('No valid fields to fit or apply model to.')


def assert_any_rows(df):
    """Make sure there are valid row(s).

    Args:
        df (dataframe): input dataframe

    Raises:
        RuntimeError
    """
    if len(df) == 0:
        raise RuntimeError('No valid events; check for null or non-numeric values in numeric fields')


def sort_fields(df):
    """Sort dataframe by column.

    Args:
        df (dataframe): input dataframe

    Returns:
        (list): list of columns
    """
    df.sort_index(inplace=True, axis=1)
    return list(df.columns)


def fill_missing_fields(df, requested_fields):
    """Fill missing fields with 0's.

    Args:
        df (dataframe): input dataframe
        requested_fields (list): column names

    Returns:
        df (dataframe): output dataframe
    """
    missing_fields = set(requested_fields).difference(set(df.columns))
    if len(missing_fields) > 0:
        cexc.logger.debug('Filling missing fields(s): %s',
                          ', '.join(missing_fields))
        for col in missing_fields:
            df[col] = 0
    return df


def apply_in_chunks(df, func, n=1000, options=None):
    """Make prediction chunk by chunk.

    Args:
        df (dataframe): input dataframe
        func (callable): function that defines apply behavior
        n (int): number of rows per chunk
        options (dict): options

    Returns:
        df (dataframe): output dataframe
    """
    def bechunk(df_, n_):
        return [df_[i:i + n_] for i in xrange(0, len(df_), n_)]

    dfs = [func(x, options) for x in bechunk(df, n)]

    df = pd.DataFrame()
    df = df.append(dfs).copy()
    df.reset_index(drop=True, inplace=True)

    return df


def get_indicies_of_unseen_categorical_values(X, columns):
    """Find the X axis indices (row numbers) where new values are present.

    Args:
        X (dataframe): feature dataframe
        columns (list): column names

    Returns:
        new_cat_idx (np array): row indices
        new_categorical_columns (np array): new categorical columns
    """
    new_categorical_columns = np.setdiff1d(X.columns, columns)
    if len(new_categorical_columns) == 0:
        return (new_categorical_columns, None)
    new_cat_idx = np.where(X[new_categorical_columns].any(axis=1).values)[0]
    return new_cat_idx, new_categorical_columns


def skip_unseen_categorical_values(X, y, row_idx, new_categorical_columns):
    """Remove rows with unseen categorical value(s) from X.

    Args:
        X (dataframe): feature dataframe
        y (pd series): target series
        row_idx (np array): row indices
        new_categorical_columns (np array): new categorical columns

    Returns:
        X (dataframe): feature dataframe
        y (pd series): target series
    """
    X.drop(row_idx, axis=0, inplace=True)
    X.drop(new_categorical_columns, axis=1, inplace=True)
    if y is not None:
        y.drop(row_idx, axis=0, inplace=True)
        cexc.messages.warn(
            "Some events containing unseen categorical feature values have been skipped while updating the model.")
    return X, y


def skip_unseen_target_values(X, y, classes):
    """Remove unseen categorical values from y. Also remove rows which
    corresponds to removed y values from X.

    Args:
        X (dataframe): feature dataframe
        y (pd series): target series
        classes (np array): unique classes

    Returns:
        X (dataframe): feature dataframe
        y (pd series): target series
    """
    new_cat_cols_y = np.setdiff1d(np.unique(y), classes)
    if len(new_cat_cols_y) == 0:
        return X, y

    # Only keep rows where y is a previously seen class
    seen_categorical_mask = y.isin(classes)
    X = X[seen_categorical_mask]
    y = y[seen_categorical_mask]

    cexc.messages.warn(
        'Some events containing unseen categorical target values have been skipped while updating the model.')
    return X, y
