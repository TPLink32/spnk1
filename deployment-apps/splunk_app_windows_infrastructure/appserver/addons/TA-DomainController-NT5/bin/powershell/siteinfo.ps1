#
# Determine all the site information for the site that this domain controller is a part of
#

# Name of Server
$ServerName = $env:ComputerName
$BSSN = "\\" + $ServerName
$WMI_DOMAIN	 = Get-WmiObject Win32_NTDomain | Where-Object {$_.DomainControllerName -eq $BSSN}
$SiteName = $WMI_DOMAIN.ClientSiteName
$ForestName = [System.DirectoryServices.ActiveDirectory.Forest]::getCurrentForest().Name

#
# This script outputs three types of data - Site data, Site Link Data and Subnet Data
#

#
# Output information about this site:
#
$Output = New-Object System.Collections.ArrayList
$Date = Get-Date -format 'yyyy-MM-ddTHH:mm:sszzz'
[void]$Output.Add($Date)			
[void]$Output.Add("Type=`"Site`"");
[void]$Output.Add("ForestName=`"$ForestName`"");
[void]$Output.Add("Site=`"$SiteName`"");

$SiteInfoObj = [System.DirectoryServices.ActiveDirectory.Forest]::getCurrentForest().Sites | Where-Object { $_.Name -eq $SiteName }

# Field AdjacentSites (Collection of ActiveDirectorySite objects, include the name only)
$SiteInfoObj.AdjacentSites | Foreach-Object { [void]$Output.Add("AdjacentSite=`"$($_.Name)`"") }

# Field Location (String)
[void]$Output.Add("Location=`"$($SiteInfoObj.Location)`"")

# Field IntersiteTopologyGenerator (DC)
$ISTG = $SiteInfoObj.IntersiteTopologyGenerator.Name
[void]$Output.Add("IntersiteTopologyGenerator=`"$ISTG`"")

# Field SiteLink (Collection of ActiveDirectorySiteLink objects, include the name only)
$SiteInfoObj.SiteLinks | Foreach-Object { [void]$Output.Add("SiteLink=`"$($_.Name)`"") }

# Field Subnet (Collection of ActiveDirectorySubnet objects, include the name only, which should be CIDR format)
$SiteInfoObj.Subnets | Foreach-Object { [void]$Output.Add("Subnet=`"$($_.Name)`"") }

# Field InterSiteReplicationSchedule (See if we can make it reasonable on a per-day basis)

# Field Options (List of Properties - for each property, include a True/False entity)
$SiteProperties = $SiteInfoObj.Options

# Output the string to stdout
[string]::join(' ', $Output) | Write-Host

#
# Output Information about Site Links in this site
#
$SiteInfoObj.SiteLinks | Foreach-Object {
	$SiteLink = New-Object System.Collections.ArrayList
	[void]$SiteLink.Add($Date)
	[void]$SiteLink.Add("Type=`"SiteLink`"")
	[void]$SiteLink.Add("ForestName=`"$ForestName`"")
	[void]$SiteLink.Add("Name=`"$($_.Name)`"")
	[void]$SiteLink.Add("Cost=$($_.Cost)")
	[void]$SiteLink.Add("DataCompressionEnabled=$($_.DataCompressionEnabled)")
	[void]$SiteLink.Add("NotificationEnabled=$($_.NotificationEnabled)")
	[void]$SiteLink.Add("ReciprocalReplicationEnabled=$($_.ReciprocalReplicationEnabled)")
	# Transport Type is RPC or SMTP - see what the value is and adjust accordingly
	[void]$SiteLink.Add("TransportType=$($_.TransportType)")
	[void]$SiteLink.Add("ReplicationIntervalSecs=$($_.ReplicationInterval.TotalSeconds)")
	# Replication Schedule on this SiteLink
	foreach ($site in $_.Sites) {
		[void]$SiteLink.Add("Site=`"$($site.Name)`"")
	}
	[string]::join(' ', $SiteLink) | Write-Host
}

#
# Output Information about Subnets in this site
#
$SiteInfoObj.Subnets | Foreach-Object {
	$Subnet = New-Object System.Collections.ArrayList
	[void]$Subnet.Add($Date)
	[void]$Subnet.Add("Type=`"Subnet`"")
	[void]$Subnet.Add("ForestName=`"$ForestName`"")
	[void]$Subnet.Add("Name=`"$($_.Name)`"")
	[void]$Subnet.Add("Site=`"$SiteName`"")
	[void]$Subnet.Add("Location=`"$($_.Location)`"")
	[string]::join(' ', $Subnet) | Write-Host
}	
	
