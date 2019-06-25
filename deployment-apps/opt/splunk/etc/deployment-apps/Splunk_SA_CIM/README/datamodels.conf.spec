
acceleration.poll_buckets_until_maxtime = <bool>
* Optional setting. Requires 6.6+
* In a distributed environment that consist of heterogenous machines, summarizations might complete sooner
  on machines with less data and faster resources. After the summarization search is finished with all of 
  the buckets, the search ends. However, the overall search runtime is determined by the slowest machine in the 
  environment. 
* When set to "true": All of the machines run for "max_time" (approximately). 
  The buckets are polled repeatedly for new data to summarize
* Set this to true if your data model is sensitive to summarization latency delays.
* When this setting is enabled, the summarization search is counted against the 
  number of concurrent searches you can run until "max_time" is reached.
* Default: false

acceleration.schedule_priority = default | higher | highest
* Optional setting. Requires 6.5+
* Raises the scheduling priority of a search:
  + "default": No scheduling priority increase.
  + "higher": Scheduling priority is higher than other data model searches.
  + "highest": Scheduling priority is higher than other searches regardless of
    scheduling tier except real-time-scheduled searches with priority = highest
    always have priority over all other searches.
  + Hence, the high-to-low order (where RTSS = real-time-scheduled search, CSS
    = continuous-scheduled search, DMAS = data-model-accelerated search, d =
    default, h = higher, H = highest) is:
      RTSS(H) > DMAS(H) > CSS(H)
      > RTSS(h) > RTSS(d) > CSS(h) > CSS(d)
      > DMAS(h) > DMAS(d)
* The scheduler honors a non-default priority only when the search owner has
  the 'edit_search_schedule_priority' capability.
* Defaults to: default
* WARNING: Having too many searches with a non-default priority will impede the
  ability of the scheduler to minimize search starvation.  Use this setting
  only for mission-critical searches.
  
tags_whitelist = <list-of-tags>
* Optional setting. Requires 6.6+
* A comma-separated list of tag fields that the data model requires 
  for its search result sets.
* This is a search performance setting. Apply it only to data models 
  that use a significant number of tag field attributes in their 
  definitions. Data models without tag fields cannot use this setting. 
  This setting does not recognize tags used in constraint searches.
* Only the tag fields identified by tag_whitelist (and the event types 
  tagged by them) are loaded when searches are performed with this 
  data model.
* If tags_whitelist is empty, the Splunk software attempts to optimize 
  out unnecessary tag fields when searches are performed with this 
  data model.
* Defaults to empty.